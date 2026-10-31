'use strict';

/**
 * Ditto Big Peer connector.
 *
 * The Node process acts as a Ditto peer ("server" connection mode) against the
 * Big Peer configured in src/config.js. It mirrors every collection
 * (passengers, crew, serviceRequests, complaints, ratings, seatMap,
 * passengerRatings, orders) between the local in-flight store and Ditto Cloud.
 *
 * Ditto Cloud requires an authenticated identity for server mode. Provide a
 * token in data/ditto-auth.json or DITTO_AUTH_TOKEN. Without a token the
 * connector reports `auth_required` and the app keeps working offline.
 */

// The Ditto native logger panics when NO_COLOR=1 (it expects true/false).
delete process.env.NO_COLOR;
if (!process.env.RUST_LOG) process.env.RUST_LOG = 'warn';

const config = require('./config');

const CLOUD_FIELDS = {
  passengers: ['_id', 'name', 'seatNumber', 'flightNumber', 'flightDate', 'medicalConditions', 'points', 'createdAt'],
  crew: ['_id', 'name', 'role', 'flightNumber', 'flightDate'],
  serviceRequests: [
    '_id',
    'passengerId',
    'passengerName',
    'seatNumber',
    'type',
    'priority',
    'details',
    'status',
    'assignedCrew',
    'createdAt',
    'acknowledgedAt',
    'resolvedAt',
    'reporterSeat'
  ],
  complaints: ['_id', 'reporterId', 'reporterSeat', 'targetSeat', 'category', 'description', 'status', 'createdAt', 'resolvedAt'],
  ratings: [
    '_id',
    'passengerId',
    'seatNumber',
    'disturbances',
    'staffBehavior',
    'cleanliness',
    'legRoom',
    'baggageSpace',
    'overall',
    'comment',
    'submittedAt',
    'pointsAwarded',
    'awardedAt'
  ],
  seatMap: ['_id', 'seatNumber', 'row', 'column', 'type', 'status'],
  passengerRatings: [
    '_id',
    'passengerId',
    'seatNumber',
    'crewId',
    'crewName',
    'score',
    'note',
    'createdAt',
    'pointsAwarded',
    'awardedAt'
  ],
  orders: [
    '_id',
    'passengerId',
    'seatNumber',
    'items',
    'paymentMethod',
    'totalRon',
    'totalPoints',
    'status',
    'assignedCrew',
    'createdAt',
    'updatedAt'
  ]
};

const EVENT_TO_COLLECTION = {
  PASSENGER_UPDATED: ['passengers', 'passenger'],
  SERVICE_REQUEST_CREATED: ['serviceRequests', 'request'],
  SERVICE_REQUEST_UPDATED: ['serviceRequests', 'request'],
  COMPLAINT_FILED: ['complaints', 'complaint'],
  COMPLAINT_UPDATED: ['complaints', 'complaint'],
  RATING_SUBMITTED: ['ratings', 'rating'],
  PASSENGER_RATED_BY_CREW: ['passengerRatings', 'passengerRating'],
  ORDER_CREATED: ['orders', 'order'],
  ORDER_UPDATED: ['orders', 'order']
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function projectDoc(collection, doc) {
  const fields = CLOUD_FIELDS[collection];
  if (!fields || !doc) return null;
  const projected = {};
  for (const field of fields) {
    if (doc[field] !== undefined) projected[field] = doc[field];
  }
  return projected;
}

class DittoCloud {
  constructor() {
    this.engine = null;
    this.ditto = null;
    this.sdk = null;
    this.started = false;
    this.queue = new Map();
    this.flushTimer = null;
    this.flushing = false;
    this.observers = [];
    this.status = {
      enabled: config.DITTO_CLOUD.enabled,
      sdk: 'unknown',
      state: config.DITTO_CLOUD.enabled ? 'idle' : 'disabled',
      authenticated: false,
      authTokenConfigured: Boolean(config.DITTO_CLOUD.authToken),
      databaseID: config.DITTO_CLOUD.databaseID,
      url: config.DITTO_CLOUD.url,
      endpoint: config.DITTO_BIG_PEER.endpoint,
      persistenceDirectory: config.DITTO_CLOUD.persistenceDirectory,
      collections: config.DITTO_CLOUD.collections,
      cloudCounts: {},
      docsPushed: 0,
      lastSyncAt: null,
      lastError: null,
      startedAt: null
    };
  }

  attach(engine) {
    this.engine = engine;
    engine.on('ditto-event', (event) => this.onEngineEvent(event));
    return this;
  }

  getStatus() {
    return {
      ...this.status,
      cloudCounts: { ...this.status.cloudCounts },
      queueSize: this.queue.size
    };
  }

  isConnected() {
    return Boolean(this.ditto && this.status.authenticated && this.status.state === 'connected');
  }

  detectSdk() {
    try {
      require.resolve('@dittolive/ditto');
      this.status.sdk = 'available';
      return true;
    } catch (err) {
      this.status.sdk = 'missing';
      this.status.lastError =
        'The @dittolive/ditto package is not installed. Run: npm install @dittolive/ditto';
      return false;
    }
  }

  async start() {
    if (this.started) return this.getStatus();
    this.started = true;
    this.status.startedAt = new Date().toISOString();

    if (!config.DITTO_CLOUD.enabled) {
      this.status.state = 'disabled';
      return this.getStatus();
    }

    this.detectSdk();
    if (this.status.sdk === 'missing') {
      this.status.state = 'sdk_missing';
      console.warn('[ditto-cloud]', this.status.lastError);
      return this.getStatus();
    }

    if (!config.DITTO_CLOUD.authToken) {
      this.status.state = 'auth_required';
      this.status.lastError =
        'Ditto Cloud needs an auth token. Add it to data/ditto-auth.json ({ "token": "..." }) or set DITTO_AUTH_TOKEN, then restart the server.';
      console.warn('[ditto-cloud] Auth token missing – running as an offline peer.');
      return this.getStatus();
    }

    await this.connect();
    return this.getStatus();
  }

  async connect() {
    this.status.state = 'connecting';
    try {
      const sdk = require('@dittolive/ditto');
      this.sdk = sdk;
      const { Ditto, DittoConfig, Authenticator } = sdk;

      const dittoConfig = new DittoConfig({
        databaseID: config.DITTO_CLOUD.databaseID,
        connect: { mode: 'server', url: config.DITTO_CLOUD.url },
        persistenceDirectory: config.DITTO_CLOUD.persistenceDirectory
      });

      this.ditto = await Ditto.open(dittoConfig);

      this.ditto.auth.observeStatus((authStatus) => {
        this.status.authenticated = Boolean(authStatus && authStatus.isAuthenticated);
        if (this.status.authenticated) this.status.state = 'connected';
      });

      await this.ditto.auth.setExpirationHandler(async () => {
        try {
          await this.login();
        } catch (err) {
          this.status.lastError = 'Re-authentication failed: ' + err.message;
        }
      });

      await this.login();
      this.ditto.sync.start();
      this.status.state = 'connected';

      console.log(
        '[ditto-cloud] Connected to Big Peer',
        config.DITTO_CLOUD.databaseID,
        'via',
        config.DITTO_CLOUD.url
      );

      await this.bootstrap();
      this.observe();
    } catch (err) {
      this.status.state = 'error';
      this.status.authenticated = false;
      this.status.lastError = err && err.message ? err.message : String(err);
      console.error('[ditto-cloud] Connection failed:', this.status.lastError);
    }
  }

  async login() {
    if (!this.ditto) throw new Error('Ditto is not open');
    const { Authenticator } = this.sdk;
    const provider =
      config.DITTO_CLOUD.authProvider === 'development'
        ? Authenticator.DEVELOPMENT_PROVIDER
        : config.DITTO_CLOUD.authProvider;

    const loginPromise = this.ditto.auth.login(config.DITTO_CLOUD.authToken, provider);
    const timeoutPromise = sleep(20000).then(() => {
      throw new Error('Ditto login timed out after 20s');
    });

    const result = await Promise.race([loginPromise, timeoutPromise]);
    if (result && result.error) {
      throw new Error(result.error.message || 'Ditto authentication rejected the token');
    }

    this.status.authenticated = true;
    this.status.lastError = null;
    this.status.state = 'connected';
    console.log('[ditto-cloud] Authenticated with the Big Peer');
    return result;
  }

  async bootstrap() {
    const counts = {};
    let total = 0;

    for (const collection of config.DITTO_CLOUD.collections) {
      const result = await this.ditto.store.execute(`SELECT * FROM ${collection}`);
      const docs = result.items.map((item) => item.value);
      counts[collection] = docs.length;
      total += docs.length;
      if (docs.length) this.engine.applyCloudCollection(collection, docs);
    }

    this.status.cloudCounts = counts;

    if (total === 0) {
      console.log('[ditto-cloud] Big Peer is empty – seeding it from the local store');
      await this.pushSnapshot();
    } else {
      console.log('[ditto-cloud] Loaded remote collections:', counts);
    }
  }

  observe() {
    for (const collection of config.DITTO_CLOUD.collections) {
      try {
        const observer = this.ditto.store.registerObserver(`SELECT * FROM ${collection}`, (result) => {
          try {
            const docs = result.items.map((item) => item.value);
            if (!docs.length) return;
            this.status.cloudCounts[collection] = docs.length;
            this.engine.applyCloudCollection(collection, docs);
          } catch (err) {
            this.status.lastError = err.message;
          }
        });
        this.observers.push(observer);
      } catch (err) {
        this.status.lastError = 'Observer failed for ' + collection + ': ' + err.message;
      }
    }
  }

  localDocs(collection) {
    const engine = this.engine;
    if (!engine) return [];
    const state = engine.getState();
    switch (collection) {
      case 'passengers':
        return Object.values(state.passengers || {});
      case 'crew':
        return state.crew || [];
      default:
        return state[collection] || [];
    }
  }

  async pushSnapshot() {
    for (const collection of config.DITTO_CLOUD.collections) {
      for (const doc of this.localDocs(collection)) {
        await this.pushDoc(collection, doc);
      }
    }
    this.status.lastSyncAt = new Date().toISOString();
  }

  async pushDoc(collection, doc) {
    if (!this.ditto || !doc || !doc._id) return;
    const projected = projectDoc(collection, doc);
    if (!projected) return;

    try {
      await this.ditto.store.execute(
        `INSERT INTO ${collection} DOCUMENTS (:doc) ON ID CONFLICT DO UPDATE`,
        { doc: projected }
      );
      this.status.docsPushed += 1;
      this.status.lastSyncAt = new Date().toISOString();
      this.status.lastError = null;
    } catch (err) {
      this.status.lastError = 'Push to ' + collection + ' failed: ' + err.message;
    }
  }

  onEngineEvent(event) {
    if (!event || event.origin === 'cloud') return;
    if (!this.isConnected()) return;

    if (event.type === 'STORE_RESET' || event.type === 'GROUND_SYNC_COMPLETED') {
      this.queue.clear();
      this.pushSnapshot().catch((err) => {
        this.status.lastError = err.message;
      });
      return;
    }

    if (event.type === 'CLOUD_COLLECTION_APPLIED') {
      return;
    }

    const mapping = EVENT_TO_COLLECTION[event.type];
    if (!mapping) return;

    const [collection, dataKey] = mapping;
    const doc = event.data && event.data[dataKey];
    if (!doc || !doc._id) return;

    this.queue.set(collection + '/' + doc._id, { collection, doc });
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((err) => {
        this.status.lastError = err.message;
      });
    }, 250);
  }

  async flush() {
    if (this.flushing || !this.isConnected()) return;
    this.flushing = true;
    try {
      while (this.queue.size) {
        const batch = Array.from(this.queue.values());
        this.queue.clear();
        for (const entry of batch) {
          await this.pushDoc(entry.collection, entry.doc);
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}

const instance = new DittoCloud();
instance.CLOUD_FIELDS = CLOUD_FIELDS;
module.exports = instance;
