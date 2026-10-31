'use strict';

const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('node:events');
const config = require('./config');
const sqlServerBridge = require('./sqlServerBridge');

const SERVICE_REQUEST_STATUSES = ['pending', 'acknowledged', 'resolved'];
const ORDER_STATUSES = ['pending', 'preparing', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['points', 'card'];

class ApiError extends Error {
  constructor(statusCode, message, code = 'BAD_REQUEST', details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function cleanText(value, maxLength = 200) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 600) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function clampStars(value) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num < 1 || num > 5) return null;
  return num;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeSeat(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().toUpperCase().match(/^(\d{1,2})\s*[- ]?\s*([A-F])$/);
  if (!match) return null;
  const row = Number(match[1]);
  if (row < 1 || row > config.FLIGHT.rows) return null;
  return `${row}${match[2]}`;
}

function normalizeFlightNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function seatType(column) {
  if (column === 'A' || column === 'F') return 'window';
  if (column === 'C' || column === 'D') return 'aisle';
  return 'middle';
}

function nowIso() {
  return new Date().toISOString();
}

class DittoEngine extends EventEmitter {
  constructor() {
    super();
    this.dataPath = config.DATA_FILE;
    this.state = null;
    this.lastPersistError = null;
    this.load();
  }

  /* ------------------------------------------------------------------ *
   * Boot / persistence
   * ------------------------------------------------------------------ */

  load() {
    let restored = null;
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') restored = parsed;
      }
    } catch (err) {
      console.warn('[ditto] Existing store could not be read, starting from seed:', err.message);
    }

    if (restored) {
      this.state = this.normalizeState(restored);
      this.rebuildSeatMap();
      console.log('[ditto] Restored mesh store from', path.basename(this.dataPath));
      this.persist('restore');
    } else {
      this.state = this.createInitialState();
      this.persist('seed');
      console.log('[ditto] Seeded a fresh mesh store (BA123 / 2025-01-15)');
    }
  }

  createInitialState() {
    const flight = config.FLIGHT;
    const seededAt = nowIso();
    const docId = (seat) => `${flight.flightNumber}_${flight.flightDate}_${seat}`;

    const seatSeed = [
      {
        seat: '12A',
        name: 'John Doe',
        conditions: ['peanut_allergy'],
        points: 0,
        createdAt: '2025-01-15T08:00:00.000Z'
      },
      {
        seat: '14C',
        name: 'Alice Smith',
        conditions: ['asthma'],
        points: 10,
        createdAt: '2025-01-15T08:05:00.000Z'
      },
      {
        seat: '15D',
        name: 'Bob Johnson',
        conditions: [],
        points: 25,
        createdAt: '2025-01-15T08:10:00.000Z'
      }
    ];

    const passengers = {};
    for (const p of seatSeed) {
      passengers[p.seat] = {
        _id: docId(p.seat),
        name: p.name,
        seatNumber: p.seat,
        flightNumber: flight.flightNumber,
        flightDate: flight.flightDate,
        medicalConditions: p.conditions,
        allergies: '',
        specialNeeds: '',
        points: p.points,
        createdAt: p.createdAt,
        updatedAt: seededAt
      };
    }

    return {
      flightInfo: {
        ...flight,
        flightPhase: 'in_flight_mesh',
        altitude: flight.cruisingAltitude,
        flightStatus: 'Cruising FL360 – offline Ditto mesh',
        wifiConnected: false,
        groundSyncAt: null,
        bigPeer: config.DITTO_BIG_PEER,
        sqlServer: {
          databaseName: config.SQL_SERVER.databaseName,
          bundledDirectory: config.SQL_SERVER.bundledDirectory,
          mirrorDirectory: config.SQL_SERVER.mirrorDirectory
        }
      },
      meshTopology: {
        protocol: 'Ditto Small Peer (BLE + LAN) → Big Peer Cloud',
        activePeersCount: 5,
        connectedPeers: [
          { id: 'peer-crew-lead', role: 'crew', name: 'Lead Steward Tablet – Jane Smith', protocol: 'BLE + LAN' },
          { id: 'peer-crew-2', role: 'crew', name: 'Steward Tablet – Mark Davis', protocol: 'BLE + LAN' },
          { id: 'peer-cabin-relay', role: 'relay', name: 'Cabin Ceiling Mesh Relay', protocol: 'Wi-Fi Direct' },
          { id: 'peer-passenger-12A', role: 'passenger', name: 'Passenger Device – Seat 12A', protocol: 'Ditto Small Peer' },
          { id: 'peer-passenger-14C', role: 'passenger', name: 'Passenger Device – Seat 14C', protocol: 'Ditto Small Peer' }
        ]
      },
      crew: [
        { _id: 'crew_001', name: 'Jane Smith', role: 'senior_steward', pin: '1234', flightNumber: flight.flightNumber, flightDate: flight.flightDate },
        { _id: 'crew_002', name: 'Mark Davis', role: 'steward', pin: '5678', flightNumber: flight.flightNumber, flightDate: flight.flightDate }
      ],
      passengers,
      serviceRequests: [
        {
          _id: 'req_001',
          passengerId: docId('12A'),
          passengerName: 'John Doe',
          seatNumber: '12A',
          type: 'drink',
          priority: 'normal',
          details: 'Water with no ice',
          status: 'pending',
          assignedCrew: null,
          createdAt: '2025-01-15T09:30:00.000Z',
          acknowledgedAt: null,
          resolvedAt: null
        },
        {
          _id: 'req_002',
          passengerId: docId('14C'),
          passengerName: 'Alice Smith',
          seatNumber: '14C',
          type: 'medical_emergency',
          priority: 'critical',
          details: 'Feeling dizzy, needs oxygen',
          status: 'acknowledged',
          assignedCrew: 'crew_001',
          createdAt: '2025-01-15T10:15:00.000Z',
          acknowledgedAt: '2025-01-15T10:16:00.000Z',
          resolvedAt: null
        }
      ],
      complaints: [
        {
          _id: 'complaint_001',
          reporterId: docId('12A'),
          reporterSeat: '12A',
          targetSeat: '14C',
          category: 'noise',
          description: 'Passenger is playing loud music',
          status: 'filed',
          createdAt: '2025-01-15T10:15:00.000Z',
          resolvedAt: null
        }
      ],
      ratings: [
        {
          _id: 'rating_001',
          passengerId: docId('12A'),
          seatNumber: '12A',
          disturbances: 4,
          staffBehavior: 5,
          cleanliness: 5,
          legRoom: 3,
          baggageSpace: 3,
          overall: 4,
          comment: 'Pleasant flight, very kind crew.',
          submittedAt: '2025-01-15T12:00:00.000Z',
          pointsAwarded: null,
          awardedAt: null
        }
      ],
      passengerRatings: [
        {
          _id: 'pr_001',
          passengerId: docId('12A'),
          seatNumber: '12A',
          crewId: 'crew_001',
          score: 5,
          note: 'Very polite and cooperative during the flight.',
          createdAt: '2025-01-15T12:30:00.000Z',
          pointsAwarded: null,
          awardedAt: null
        }
      ],
      orders: [],
      seatMap: [],
      syncLog: [],
      meta: {
        app: config.APP_NAME,
        version: 2,
        createdAt: seededAt,
        updatedAt: seededAt,
        lastEvent: null
      }
    };
  }

  normalizeState(raw) {
    const base = this.createInitialState();
    const rawFlight = raw.flightInfo && typeof raw.flightInfo === 'object' ? raw.flightInfo : {};

    // The flight identity is always canonical (config.js) – only the live
    // phase flags survive a restart. This kills every stale-schema drift bug.
    const flightInfo = {
      ...config.FLIGHT,
      flightPhase: rawFlight.flightPhase || base.flightInfo.flightPhase,
      altitude: rawFlight.altitude || base.flightInfo.altitude,
      flightStatus: rawFlight.flightStatus || base.flightInfo.flightStatus,
      wifiConnected: Boolean(rawFlight.groundSyncAt && rawFlight.wifiConnected),
      groundSyncAt: rawFlight.groundSyncAt || null,
      bigPeer: config.DITTO_BIG_PEER,
      sqlServer: {
        databaseName: config.SQL_SERVER.databaseName,
        bundledDirectory: config.SQL_SERVER.bundledDirectory,
        mirrorDirectory: config.SQL_SERVER.mirrorDirectory
      }
    };

    const state = {
      flightInfo,
      meshTopology: base.meshTopology,
      crew: base.crew,
      passengers: {},
      serviceRequests: Array.isArray(raw.serviceRequests) ? raw.serviceRequests : [],
      complaints: Array.isArray(raw.complaints) ? raw.complaints : [],
      ratings: Array.isArray(raw.ratings) ? raw.ratings : [],
      passengerRatings: Array.isArray(raw.passengerRatings) ? raw.passengerRatings : [],
      orders: Array.isArray(raw.orders) ? raw.orders : [],
      seatMap: Array.isArray(raw.seatMap) ? raw.seatMap : [],
      syncLog: Array.isArray(raw.syncLog) ? raw.syncLog : [],
      meta: { ...base.meta, ...(raw.meta || {}) }
    };

    // Passengers used to be keyed by _id in older builds – re-key by seat.
    const rawPassengers = raw.passengers && typeof raw.passengers === 'object' ? raw.passengers : {};
    for (const value of Object.values(rawPassengers)) {
      if (!value || typeof value !== 'object') continue;
      const seat = normalizeSeat(value.seatNumber || value.seat);
      if (!seat) continue;
      state.passengers[seat] = {
        _id: value._id || value.id || `${config.FLIGHT.flightNumber}_${config.FLIGHT.flightDate}_${seat}`,
        name: cleanText(value.name, 80) || `Pasager ${seat}`,
        seatNumber: seat,
        flightNumber: normalizeFlightNumber(value.flightNumber) || config.FLIGHT.flightNumber,
        flightDate: normalizeDate(value.flightDate) || config.FLIGHT.flightDate,
        medicalConditions: this.normalizeConditions(value.medicalConditions),
        allergies: cleanText(value.allergies, 200),
        specialNeeds: cleanText(value.specialNeeds, 200),
        points: Math.max(0, Math.round(Number(value.points ?? value.pointsBalance) || 0)),
        createdAt: value.createdAt || nowIso(),
        updatedAt: value.updatedAt || value.createdAt || nowIso()
      };
    }

    state.serviceRequests = state.serviceRequests
      .map((req) => this.normalizeServiceRequest(req, state))
      .filter(Boolean);
    state.orders = state.orders.map((order) => this.normalizeOrder(order)).filter(Boolean);
    state.complaints = state.complaints.filter((c) => c && c.targetSeat && c.reporterId);
    state.ratings = state.ratings
      .filter((r) => r && r.passengerId)
      .map((rating) => {
        const fields = ['disturbances', 'staffBehavior', 'cleanliness', 'legRoom', 'baggageSpace'];
        const values = fields.map((field) => {
          const num = Math.round(Number(rating[field]));
          return Number.isFinite(num) && num >= 1 && num <= 5 ? num : 3;
        });
        const overall = Number(rating.overall);
        return {
          ...rating,
          ...Object.fromEntries(fields.map((field, index) => [field, values[index]])),
          overall:
            Number.isFinite(overall) && overall >= 1 && overall <= 5
              ? Math.round(overall)
              : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        };
      });
    state.passengerRatings = state.passengerRatings.filter((r) => r && r.passengerId);

    // Flight stays in the air after a reload unless the ground sync already ran.
    if (!state.flightInfo.groundSyncAt) {
      state.flightInfo.wifiConnected = false;
      state.flightInfo.flightPhase = 'in_flight_mesh';
      state.flightInfo.altitude = config.FLIGHT.cruisingAltitude;
      state.flightInfo.flightStatus = 'Cruising FL360 – offline Ditto mesh';
    } else {
      state.flightInfo.wifiConnected = true;
      state.flightInfo.flightPhase = 'ground_wifi_sync';
      state.flightInfo.altitude = '0 ft';
      state.flightInfo.flightStatus = 'Aterizat – sincronizare Wi-Fi la sol';
    }

    state.meta.version = 2;
    return state;
  }

  normalizeServiceRequest(req, state) {
    if (!req || typeof req !== 'object') return null;
    const seat = normalizeSeat(req.seatNumber) || this.seatFromPassengerId(req.passengerId, state);
    if (!seat) return null;
    const passenger = state.passengers[seat];
    const type = req.type === 'medical_emergency' ? 'medical_emergency' : cleanText(req.type, 24) || 'assistance';
    return {
      _id: req._id || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      passengerId: req.passengerId || (passenger ? passenger._id : `${config.FLIGHT.flightNumber}_${config.FLIGHT.flightDate}_${seat}`),
      passengerName: passenger ? passenger.name : cleanText(req.passengerName, 80) || `Pasager ${seat}`,
      seatNumber: seat,
      type,
      priority: req.priority || (type === 'medical_emergency' ? 'critical' : 'normal'),
      details: cleanMultiline(req.details, 500) || 'Solicitare la bord',
      status: SERVICE_REQUEST_STATUSES.includes(req.status) ? req.status : 'pending',
      assignedCrew: req.assignedCrew || null,
      createdAt: req.createdAt || nowIso(),
      acknowledgedAt: req.acknowledgedAt || null,
      resolvedAt: req.resolvedAt || null,
      reporterSeat: req.reporterSeat || null
    };
  }

  normalizeOrder(order) {
    if (!order || typeof order !== 'object') return null;
    const seat = normalizeSeat(order.seatNumber);
    if (!seat) return null;
    const items = Array.isArray(order.items) ? order.items : [];
    const paymentMethod = PAYMENT_METHODS.includes(order.paymentMethod) ? order.paymentMethod : 'card';
    return {
      _id: order._id || `ord_${Date.now().toString(36)}`,
      passengerId: order.passengerId || `${config.FLIGHT.flightNumber}_${config.FLIGHT.flightDate}_${seat}`,
      passengerName: cleanText(order.passengerName, 80) || `Pasager ${seat}`,
      seatNumber: seat,
      items,
      paymentMethod,
      totalRon: roundMoney(order.totalRon || 0),
      totalPoints: Math.max(0, Math.round(Number(order.totalPoints) || 0)),
      status: ORDER_STATUSES.includes(order.status) ? order.status : 'pending',
      assignedCrew: order.assignedCrew || null,
      createdAt: order.createdAt || nowIso(),
      updatedAt: order.updatedAt || order.createdAt || nowIso()
    };
  }

  rebuildSeatMap() {
    const seats = [];
    for (const passenger of Object.values(this.state.passengers)) {
      const row = Number(passenger.seatNumber.replace(/\D/g, ''));
      const column = passenger.seatNumber.replace(/\d/g, '');
      seats.push({
        _id: passenger.seatNumber,
        seatNumber: passenger.seatNumber,
        row,
        column,
        type: seatType(column),
        status: 'occupied',
        passengerId: passenger._id
      });
    }
    seats.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column));
    this.state.seatMap = seats;
  }

  persist(reason = 'mutation') {
    this.state.meta.updatedAt = nowIso();
    this.state.meta.lastEvent = reason;
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.dataPath, JSON.stringify(this.state, null, 2), 'utf8');
      this.lastPersistError = null;
    } catch (err) {
      this.lastPersistError = err.message;
      console.error('[ditto] Failed to persist store:', err.message);
    }

    try {
      sqlServerBridge.exportJsonDump(this.state);
      sqlServerBridge.generateSyncSql(this.state, reason);
    } catch (err) {
      console.error('[ditto] Failed to refresh SQL artifacts:', err.message);
    }
  }

  emitEvent(type, data, collection) {
    this.persist(type);
    this.emit('ditto-event', {
      type,
      collection,
      origin: 'local',
      data,
      timestamp: nowIso()
    });
  }

  /**
   * Replace one collection with the snapshot coming from the Ditto Big Peer.
   * Called by src/dittoCloud.js when remote documents arrive. Cloud data is
   * authoritative for that collection; the change is broadcast to the UIs.
   */
  applyCloudCollection(collection, docs) {
    if (!Array.isArray(docs) || docs.length === 0) return false;

    const clean = docs.filter((doc) => doc && typeof doc === 'object' && doc._id);
    if (!clean.length) return false;

    switch (collection) {
      case 'passengers': {
        const passengers = {};
        for (const doc of clean) {
          const seat = normalizeSeat(doc.seatNumber);
          if (!seat) continue;
          passengers[seat] = {
            _id: doc._id,
            name: cleanText(doc.name, 80) || `Pasager ${seat}`,
            seatNumber: seat,
            flightNumber: normalizeFlightNumber(doc.flightNumber) || config.FLIGHT.flightNumber,
            flightDate: normalizeDate(doc.flightDate) || config.FLIGHT.flightDate,
            medicalConditions: this.normalizeConditions(doc.medicalConditions),
            allergies: '',
            specialNeeds: '',
            points: Math.max(0, Math.round(Number(doc.points) || 0)),
            createdAt: doc.createdAt || nowIso(),
            updatedAt: nowIso()
          };
        }
        if (!Object.keys(passengers).length) return false;
        this.state.passengers = passengers;
        this.rebuildSeatMap();
        break;
      }
      case 'crew': {
        this.state.crew = clean.map((doc) => {
          const existing = this.state.crew.find((c) => c._id === doc._id);
          return {
            _id: doc._id,
            name: cleanText(doc.name, 80) || doc._id,
            role: cleanText(doc.role, 40) || 'steward',
            pin: existing ? existing.pin : '',
            flightNumber: normalizeFlightNumber(doc.flightNumber) || config.FLIGHT.flightNumber,
            flightDate: normalizeDate(doc.flightDate) || config.FLIGHT.flightDate
          };
        });
        break;
      }
      case 'serviceRequests': {
        this.state.serviceRequests = clean
          .map((doc) => this.normalizeServiceRequest(doc, this.state))
          .filter(Boolean);
        break;
      }
      case 'complaints':
        this.state.complaints = clean.map((doc) => ({
          _id: doc._id,
          reporterId: doc.reporterId,
          reporterSeat: doc.reporterSeat || this.seatFromPassengerId(doc.reporterId, this.state) || '',
          targetSeat: doc.targetSeat,
          category: doc.category || 'other',
          description: doc.description || '',
          status: doc.status || 'filed',
          createdAt: doc.createdAt || nowIso(),
          resolvedAt: doc.resolvedAt || null
        }));
        break;
      case 'ratings':
        this.state.ratings = clean.map((doc) => {
          const values = ['disturbances', 'staffBehavior', 'cleanliness', 'legRoom', 'baggageSpace'].map((field) =>
            Math.min(5, Math.max(1, Math.round(Number(doc[field]) || 3)))
          );
          const overall = Number(doc.overall);
          return {
            _id: doc._id,
            passengerId: doc.passengerId,
            seatNumber: doc.seatNumber || this.seatFromPassengerId(doc.passengerId, this.state) || '',
            disturbances: values[0],
            staffBehavior: values[1],
            cleanliness: values[2],
            legRoom: values[3],
            baggageSpace: values[4],
            overall: Number.isFinite(overall) && overall >= 1 && overall <= 5 ? Math.round(overall) : Math.round(values.reduce((sum, value) => sum + value, 0) / 5),
            comment: doc.comment || '',
            submittedAt: doc.submittedAt || nowIso(),
            pointsAwarded: doc.pointsAwarded || null,
            awardedAt: doc.awardedAt || null
          };
        });
        break;
      case 'passengerRatings':
        this.state.passengerRatings = clean.map((doc) => ({
          _id: doc._id,
          passengerId: doc.passengerId,
          seatNumber: doc.seatNumber || this.seatFromPassengerId(doc.passengerId, this.state) || '',
          crewId: doc.crewId,
          crewName: doc.crewName || (this.getCrewMember(doc.crewId) || {}).name || doc.crewId,
          score: Math.min(5, Math.max(1, Math.round(Number(doc.score) || 3))),
          note: doc.note || '',
          createdAt: doc.createdAt || nowIso(),
          pointsAwarded: doc.pointsAwarded || null,
          awardedAt: doc.awardedAt || null
        }));
        break;
      case 'orders':
        this.state.orders = clean.map((doc) => this.normalizeOrder(doc)).filter(Boolean);
        break;
      case 'seatMap':
        this.state.seatMap = clean.map((doc) => ({
          _id: doc._id,
          seatNumber: doc.seatNumber,
          row: Number(doc.row),
          column: doc.column,
          type: doc.type,
          status: doc.status,
          passengerId: doc.passengerId || null
        }));
        break;
      default:
        return false;
    }

    this.persist('CLOUD_' + collection);
    this.emit('ditto-event', {
      type: 'CLOUD_COLLECTION_APPLIED',
      collection,
      origin: 'cloud',
      data: { count: clean.length },
      timestamp: nowIso()
    });
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  normalizeConditions(value) {
    const allowed = new Set(config.MEDICAL_CONDITIONS_LIST.map((c) => c.id));
    const list = Array.isArray(value) ? value : value ? [value] : [];
    const cleaned = [];
    let sawNone = false;
    for (const id of list) {
      if (typeof id !== 'string') continue;
      const key = id.trim();
      if (!allowed.has(key)) continue;
      if (key === 'none') {
        sawNone = true;
        continue;
      }
      if (!cleaned.includes(key)) cleaned.push(key);
    }
    if (cleaned.length) return cleaned;
    return sawNone ? ['none'] : ['none'];
  }

  seatFromPassengerId(passengerId, state = this.state) {
    if (!passengerId) return null;
    for (const p of Object.values(state.passengers)) {
      if (p._id === passengerId) return p.seatNumber;
    }
    const match = String(passengerId).match(/_(\d{1,2}[A-F])$/i);
    return match ? normalizeSeat(match[1]) : null;
  }

  getPassengerBySeat(seat) {
    const normalized = normalizeSeat(seat);
    return normalized ? this.state.passengers[normalized] || null : null;
  }

  getPassengerById(passengerId) {
    return Object.values(this.state.passengers).find((p) => p._id === passengerId) || null;
  }

  ensurePassenger(rawSeat, nameHint) {
    const seat = normalizeSeat(rawSeat);
    if (!seat) {
      throw new ApiError(400, `Număr de loc invalid: "${rawSeat}"`, 'INVALID_SEAT');
    }
    const existing = this.state.passengers[seat];
    if (existing) return existing;

    const passenger = {
      _id: `${config.FLIGHT.flightNumber}_${config.FLIGHT.flightDate}_${seat}`,
      name: cleanText(nameHint, 80) || `Pasager ${seat}`,
      seatNumber: seat,
      flightNumber: config.FLIGHT.flightNumber,
      flightDate: config.FLIGHT.flightDate,
      medicalConditions: ['none'],
      allergies: '',
      specialNeeds: '',
      points: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.state.passengers[seat] = passenger;
    this.rebuildSeatMap();
    return passenger;
  }

  getCrewMember(crewId) {
    return this.state.crew.find((c) => c._id === crewId) || null;
  }

  authenticateCrew(crewId, pin) {
    const id = cleanText(crewId, 40).toLowerCase();
    const crew = this.state.crew.find(
      (c) => c._id.toLowerCase() === id || c.name.toLowerCase() === id
    );
    if (!crew) {
      throw new ApiError(401, 'ID echipaj necunoscut. Încearcă crew_001 sau crew_002.', 'INVALID_CREW');
    }
    if (String(crew.pin || '') !== String(pin || '')) {
      throw new ApiError(401, 'PIN de securitate incorect.', 'INVALID_PIN');
    }
    const { pin: _pin, ...safe } = crew;
    return safe;
  }

  resolveCrew(crewId) {
    if (crewId) {
      const crew = this.getCrewMember(crewId);
      if (!crew) throw new ApiError(400, `Membru de echipaj necunoscut: ${crewId}`, 'UNKNOWN_CREW');
      return crew;
    }
    return this.state.crew[0] || null;
  }

  nextId(prefix, collection) {
    const stamp = Date.now().toString(36);
    const salt = Math.random().toString(36).slice(2, 6);
    return `${prefix}_${stamp}${salt}`;
  }

  getPendingPoints() {
    const pending = {};
    const ensure = (passengerId) => {
      if (!pending[passengerId]) {
        pending[passengerId] = { reviewPoints: 0, crewRatingPoints: 0, total: 0 };
      }
      return pending[passengerId];
    };

    for (const rating of this.state.ratings) {
      if (rating.pointsAwarded) continue;
      const entry = ensure(rating.passengerId);
      entry.reviewPoints += config.POINTS.perReview;
      entry.total += config.POINTS.perReview;
    }
    for (const rating of this.state.passengerRatings) {
      if (rating.pointsAwarded) continue;
      const entry = ensure(rating.passengerId);
      entry.crewRatingPoints += config.POINTS.perCrewRating;
      entry.total += config.POINTS.perCrewRating;
    }
    return pending;
  }

  getStats() {
    const requests = this.state.serviceRequests;
    const openRequests = requests.filter((r) => r.type !== 'medical_emergency' && r.status !== 'resolved');
    const openEmergencies = requests.filter((r) => r.type === 'medical_emergency' && r.status !== 'resolved');
    return {
      passengers: Object.keys(this.state.passengers).length,
      crew: this.state.crew.length,
      openRequests: openRequests.length,
      openEmergencies: openEmergencies.length,
      openComplaints: this.state.complaints.filter((c) => c.status !== 'resolved').length,
      openOrders: this.state.orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length,
      reviews: this.state.ratings.length,
      crewRatings: this.state.passengerRatings.length,
      wifiConnected: Boolean(this.state.flightInfo.wifiConnected),
      peerCount: this.state.meshTopology.activePeersCount,
      pendingPoints: Object.values(this.getPendingPoints()).reduce((sum, item) => sum + item.total, 0)
    };
  }

  getPublicState() {
    return {
      state: this.state,
      config: {
        appName: config.APP_NAME,
        flight: config.FLIGHT,
        menu: config.MENU_ITEMS,
        medicalConditions: config.MEDICAL_CONDITIONS_LIST,
        complaintCategories: config.COMPLAINT_CATEGORIES,
        serviceTypes: config.SERVICE_REQUEST_TYPES,
        points: config.POINTS,
        bigPeer: config.DITTO_BIG_PEER,
        sqlServer: config.SQL_SERVER
      },
      stats: this.getStats(),
      pendingPoints: this.getPendingPoints()
    };
  }

  getState() {
    return this.state;
  }

  /* ------------------------------------------------------------------ *
   * Passenger onboarding
   * ------------------------------------------------------------------ */

  registerOrUpdatePassenger(payload = {}) {
    const seat = normalizeSeat(payload.seatNumber);
    if (!seat) {
      throw new ApiError(400, `Număr de loc invalid: "${payload.seatNumber ?? ''}" (ex: 12A)`, 'INVALID_SEAT');
    }
    const name = cleanText(payload.name, 80);
    if (!name) {
      throw new ApiError(400, 'Numele pasagerului este obligatoriu.', 'MISSING_NAME');
    }

    const flightNumber = normalizeFlightNumber(payload.flightNumber) || config.FLIGHT.flightNumber;
    const flightDate = normalizeDate(payload.flightDate) || config.FLIGHT.flightDate;
    const medicalConditions = this.normalizeConditions(payload.medicalConditions);
    const existing = this.state.passengers[seat] || null;

    const passenger = {
      _id: `${flightNumber}_${flightDate}_${seat}`,
      name,
      seatNumber: seat,
      flightNumber,
      flightDate,
      medicalConditions,
      allergies: cleanText(payload.allergies, 200),
      specialNeeds: cleanText(payload.specialNeeds, 200),
      points: existing ? Math.max(0, Math.round(Number(existing.points) || 0)) : 0,
      createdAt: existing ? existing.createdAt : nowIso(),
      updatedAt: nowIso()
    };

    this.state.passengers[seat] = passenger;
    this.rebuildSeatMap();

    // Keep already filed records in sync with a renamed / moved passenger.
    for (const req of this.state.serviceRequests) {
      if (req.passengerId === (existing && existing._id)) {
        req.passengerId = passenger._id;
        req.passengerName = passenger.name;
        req.seatNumber = seat;
      }
    }

    this.emitEvent('PASSENGER_UPDATED', { passenger, created: !existing }, 'passengers');
    return passenger;
  }

  /* ------------------------------------------------------------------ *
   * Service requests & medical emergencies
   * ------------------------------------------------------------------ */

  createServiceRequest(payload = {}) {
    const seat = normalizeSeat(payload.seatNumber);
    if (!seat) {
      throw new ApiError(400, `Număr de loc invalid: "${payload.seatNumber ?? ''}"`, 'INVALID_SEAT');
    }
    const allowedTypes = config.SERVICE_REQUEST_TYPES.map((t) => t.id);
    const type = allowedTypes.includes(payload.type) ? payload.type : 'assistance';
    if (type === 'medical_emergency') {
      return this.triggerMedicalEmergency(payload);
    }

    const passenger = this.ensurePassenger(seat, payload.passengerName);
    const request = {
      _id: this.nextId('req'),
      passengerId: passenger._id,
      passengerName: passenger.name,
      seatNumber: seat,
      type,
      priority: 'normal',
      details: cleanMultiline(payload.details, 500) || 'Solicitare de serviciu la bord',
      status: 'pending',
      assignedCrew: null,
      createdAt: nowIso(),
      acknowledgedAt: null,
      resolvedAt: null
    };

    this.state.serviceRequests.unshift(request);
    this.emitEvent('SERVICE_REQUEST_CREATED', { request, passenger }, 'serviceRequests');
    return request;
  }

  triggerMedicalEmergency(payload = {}) {
    const affectedSeat = normalizeSeat(payload.targetSeat) || normalizeSeat(payload.seatNumber);
    if (!affectedSeat) {
      throw new ApiError(400, 'Selectați locul persoanei afectate.', 'INVALID_SEAT');
    }
    const reporterSeat = normalizeSeat(payload.reporterSeat) || normalizeSeat(payload.seatNumber) || affectedSeat;
    const passenger = this.ensurePassenger(affectedSeat, payload.passengerName);

    const request = {
      _id: this.nextId('req'),
      passengerId: passenger._id,
      passengerName: passenger.name,
      seatNumber: affectedSeat,
      reporterSeat,
      type: 'medical_emergency',
      priority: 'critical',
      details:
        cleanMultiline(payload.details, 500) ||
        'Urgență medicală semnalată de la bord. Se solicită oxigen și trusa medicală.',
      status: 'pending',
      assignedCrew: null,
      createdAt: nowIso(),
      acknowledgedAt: null,
      resolvedAt: null
    };

    this.state.serviceRequests.unshift(request);
    this.emitEvent(
      'EMERGENCY_ALERT',
      { request, passenger, seatNumber: affectedSeat, reporterSeat },
      'serviceRequests'
    );
    return request;
  }

  updateServiceRequestStatus(payload = {}) {
    const requestId = cleanText(payload.requestId, 64);
    if (!requestId) throw new ApiError(400, 'requestId este obligatoriu.', 'MISSING_REQUEST_ID');

    const request = this.state.serviceRequests.find((r) => r._id === requestId);
    if (!request) throw new ApiError(404, `Solicitarea ${requestId} nu există.`, 'REQUEST_NOT_FOUND');

    const status = cleanText(payload.status, 24);
    if (!SERVICE_REQUEST_STATUSES.includes(status)) {
      throw new ApiError(400, `Status invalid: ${payload.status}`, 'INVALID_STATUS');
    }
    if (request.status === 'resolved' && status !== 'resolved') {
      throw new ApiError(409, 'Solicitarea este deja finalizată.', 'ALREADY_RESOLVED');
    }

    const crew = this.resolveCrew(payload.crewId || payload.assignedCrew);
    if (status !== 'pending' && crew) request.assignedCrew = crew._id;

    request.status = status;
    if (status === 'acknowledged' && !request.acknowledgedAt) request.acknowledgedAt = nowIso();
    if (status === 'resolved') {
      request.acknowledgedAt = request.acknowledgedAt || nowIso();
      request.resolvedAt = nowIso();
    }

    this.emitEvent('SERVICE_REQUEST_UPDATED', { request }, 'serviceRequests');
    return request;
  }

  /* ------------------------------------------------------------------ *
   * Complaints
   * ------------------------------------------------------------------ */

  fileComplaint(payload = {}) {
    const reporterSeat = normalizeSeat(payload.reporterSeat) || normalizeSeat(payload.seatNumber);
    if (!reporterSeat) {
      throw new ApiError(400, 'Locul reclamantului este invalid.', 'INVALID_SEAT');
    }
    const targetSeat = normalizeSeat(payload.targetSeat);
    if (!targetSeat) {
      throw new ApiError(400, 'Selectați un loc valid pentru sesizare.', 'INVALID_TARGET_SEAT');
    }
    if (targetSeat === reporterSeat) {
      throw new ApiError(400, 'Nu puteți reclama propriul loc. Alegeți alt scaun.', 'SELF_COMPLAINT');
    }

    const categories = config.COMPLAINT_CATEGORIES.map((c) => c.id);
    const category = categories.includes(payload.category) ? payload.category : 'other';
    const description = cleanMultiline(payload.description, 600);
    if (description.length < 3) {
      throw new ApiError(400, 'Descrierea sesizării este prea scurtă.', 'MISSING_DESCRIPTION');
    }

    const reporter = this.ensurePassenger(reporterSeat, payload.reporterName);
    const targetPassenger = this.state.passengers[targetSeat] || null;

    const complaint = {
      _id: this.nextId('complaint'),
      reporterId: reporter._id,
      reporterSeat,
      reporterName: reporter.name,
      targetSeat,
      targetName: targetPassenger ? targetPassenger.name : null,
      category,
      description,
      status: 'filed',
      createdAt: nowIso(),
      resolvedAt: null
    };

    this.state.complaints.unshift(complaint);
    this.emitEvent('COMPLAINT_FILED', { complaint }, 'complaints');
    return complaint;
  }

  resolveComplaint(payload = {}) {
    const complaintId = cleanText(payload.complaintId, 64);
    const complaint = this.state.complaints.find((c) => c._id === complaintId);
    if (!complaint) throw new ApiError(404, 'Sesizarea nu există.', 'COMPLAINT_NOT_FOUND');
    complaint.status = cleanText(payload.status, 24) || 'resolved';
    if (complaint.status === 'resolved') complaint.resolvedAt = nowIso();
    this.emitEvent('COMPLAINT_UPDATED', { complaint }, 'complaints');
    return complaint;
  }

  /* ------------------------------------------------------------------ *
   * Ratings (passenger → flight & crew → passenger)
   * ------------------------------------------------------------------ */

  submitRating(payload = {}) {
    const seat = normalizeSeat(payload.seatNumber) || normalizeSeat(payload.seat);
    if (!seat) throw new ApiError(400, 'Locul pasagerului este invalid.', 'INVALID_SEAT');

    const fields = ['disturbances', 'staffBehavior', 'cleanliness', 'legRoom', 'baggageSpace'];
    const overall = clampStars(payload.overall);
    const values = {};
    for (const field of fields) {
      let value = clampStars(payload[field]);
      if (value === null && overall !== null) value = overall;
      if (value === null) {
        throw new ApiError(400, `Nota pentru "${field}" trebuie să fie între 1 și 5.`, 'INVALID_RATING');
      }
      values[field] = value;
    }

    const passenger = this.ensurePassenger(seat, payload.passengerName);
    const existing = this.state.ratings.find((r) => r.passengerId === passenger._id);
    const average = Math.round(fields.reduce((sum, f) => sum + values[f], 0) / fields.length);

    const rating = {
      _id: existing ? existing._id : this.nextId('rating'),
      passengerId: passenger._id,
      seatNumber: seat,
      ...values,
      overall: overall !== null ? overall : average,
      comment: cleanMultiline(payload.comment, 600),
      submittedAt: existing ? existing.submittedAt : nowIso(),
      updatedAt: nowIso(),
      pointsAwarded: existing ? existing.pointsAwarded : null,
      awardedAt: existing ? existing.awardedAt : null
    };

    if (existing) {
      const index = this.state.ratings.indexOf(existing);
      this.state.ratings[index] = rating;
    } else {
      this.state.ratings.unshift(rating);
    }

    this.emitEvent(
      'RATING_SUBMITTED',
      { rating, updated: Boolean(existing), pointsOnTouchdown: config.POINTS.perReview },
      'ratings'
    );
    return rating;
  }

  ratePassenger(payload = {}) {
    const seat = normalizeSeat(payload.seatNumber) || normalizeSeat(payload.seat);
    if (!seat) throw new ApiError(400, 'Locul pasagerului este invalid.', 'INVALID_SEAT');

    const passenger = this.state.passengers[seat];
    if (!passenger) {
      throw new ApiError(404, `Nu există pasager înregistrat pe locul ${seat}.`, 'PASSENGER_NOT_FOUND');
    }

    const score = clampStars(payload.score ?? payload.stars);
    if (score === null) throw new ApiError(400, 'Nota trebuie să fie între 1 și 5.', 'INVALID_RATING');

    const crew = this.resolveCrew(payload.crewId);
    if (!crew) throw new ApiError(400, 'Membru de echipaj invalid.', 'UNKNOWN_CREW');

    const note = cleanMultiline(payload.note, 400) || 'Pasager cooperant pe durata zborului.';
    const existing = this.state.passengerRatings.find(
      (r) => r.passengerId === passenger._id && r.crewId === crew._id
    );

    const rating = {
      _id: existing ? existing._id : this.nextId('pr'),
      passengerId: passenger._id,
      seatNumber: seat,
      crewId: crew._id,
      crewName: crew.name,
      score,
      note,
      createdAt: existing ? existing.createdAt : nowIso(),
      updatedAt: nowIso(),
      pointsAwarded: existing ? existing.pointsAwarded : null,
      awardedAt: existing ? existing.awardedAt : null
    };

    if (existing) {
      const index = this.state.passengerRatings.indexOf(existing);
      this.state.passengerRatings[index] = rating;
    } else {
      this.state.passengerRatings.unshift(rating);
    }

    this.emitEvent(
      'PASSENGER_RATED_BY_CREW',
      { passengerRating: rating, passenger, pointsOnTouchdown: config.POINTS.perCrewRating },
      'passengerRatings'
    );
    return rating;
  }

  /* ------------------------------------------------------------------ *
   * Orders (food & drinks)
   * ------------------------------------------------------------------ */

  createOrder(payload = {}) {
    const seat = normalizeSeat(payload.seatNumber) || normalizeSeat(payload.seat);
    if (!seat) throw new ApiError(400, 'Locul pasagerului este invalid.', 'INVALID_SEAT');

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    if (!rawItems.length) throw new ApiError(400, 'Coșul este gol.', 'EMPTY_ORDER');
    if (rawItems.length > 12) throw new ApiError(400, 'Prea multe produse într-o comandă.', 'ORDER_TOO_LARGE');

    const passenger = this.ensurePassenger(seat, payload.passengerName);
    const orderPayment = PAYMENT_METHODS.includes(payload.paymentMethod) ? payload.paymentMethod : null;

    const items = [];
    let totalRon = 0;
    let totalPoints = 0;

    for (const raw of rawItems) {
      const menuItem = config.MENU_ITEMS.find((m) => m.id === raw.id);
      if (!menuItem) throw new ApiError(400, `Produs necunoscut: ${raw.id}`, 'UNKNOWN_ITEM');
      if (!menuItem.inStock) {
        throw new ApiError(409, `${menuItem.name} nu mai este disponibil la bord.`, 'OUT_OF_STOCK');
      }
      const qty = Math.round(Number(raw.qty) || 1);
      if (qty < 1 || qty > 5) {
        throw new ApiError(400, `Cantitate invalidă pentru ${menuItem.name}.`, 'INVALID_QTY');
      }

      let payWith = PAYMENT_METHODS.includes(raw.payWith) ? raw.payWith : orderPayment || 'card';
      if (menuItem.priceRon === 0) payWith = 'points';
      if (payWith === 'points' && menuItem.pricePoints <= 0) payWith = 'card';

      const line = {
        id: menuItem.id,
        name: menuItem.name,
        nameEn: menuItem.nameEn,
        icon: menuItem.icon,
        qty,
        payWith,
        priceRon: menuItem.priceRon,
        pricePoints: menuItem.pricePoints
      };
      items.push(line);

      if (payWith === 'points') totalPoints += menuItem.pricePoints * qty;
      else totalRon += menuItem.priceRon * qty;
    }

    if (totalPoints > (passenger.points || 0)) {
      throw new ApiError(
        409,
        `Puncte insuficiente: ai ${passenger.points || 0} puncte, comanda necesită ${totalPoints}.`,
        'INSUFFICIENT_POINTS',
        { balance: passenger.points || 0, required: totalPoints }
      );
    }
    if (totalPoints === 0 && totalRon === 0) {
      throw new ApiError(400, 'Comanda nu conține produse plătibile.', 'EMPTY_ORDER');
    }

    if (totalPoints > 0) passenger.points = Math.max(0, passenger.points - totalPoints);

    const order = {
      _id: this.nextId('ord'),
      passengerId: passenger._id,
      passengerName: passenger.name,
      seatNumber: seat,
      items,
      paymentMethod: totalPoints > 0 && totalRon > 0 ? 'mixed' : totalPoints > 0 ? 'points' : 'card',
      totalRon: roundMoney(totalRon),
      totalPoints,
      status: 'pending',
      assignedCrew: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    this.state.orders.unshift(order);
    this.emitEvent('ORDER_CREATED', { order, passengerPoints: passenger.points }, 'orders');
    return order;
  }

  updateOrderStatus(payload = {}) {
    const orderId = cleanText(payload.orderId, 64);
    const order = this.state.orders.find((o) => o._id === orderId);
    if (!order) throw new ApiError(404, 'Comanda nu există.', 'ORDER_NOT_FOUND');

    const status = cleanText(payload.status, 24);
    if (!ORDER_STATUSES.includes(status)) throw new ApiError(400, 'Status comandă invalid.', 'INVALID_STATUS');

    if (status === 'cancelled' && order.status !== 'cancelled' && order.totalPoints > 0) {
      const passenger = this.getPassengerById(order.passengerId);
      if (passenger) passenger.points = (passenger.points || 0) + order.totalPoints;
    }
    if (status !== 'cancelled' && order.status === 'cancelled' && order.totalPoints > 0) {
      // Re-activating a cancelled order charges the points again.
      const passenger = this.getPassengerById(order.passengerId);
      if (passenger && (passenger.points || 0) >= order.totalPoints) {
        passenger.points -= order.totalPoints;
      } else {
        throw new ApiError(409, 'Puncte insuficiente pentru reactivarea comenzii.', 'INSUFFICIENT_POINTS');
      }
    }

    const crew = this.resolveCrew(payload.crewId);
    if (crew && status !== 'pending') order.assignedCrew = crew._id;
    order.status = status;
    order.updatedAt = nowIso();

    this.emitEvent('ORDER_UPDATED', { order }, 'orders');
    return order;
  }

  /* ------------------------------------------------------------------ *
   * Ground sync (Wi-Fi → Big Peer → SQL Server)
   * ------------------------------------------------------------------ */

  async syncToGround() {
    if (!this.state.flightInfo.wifiConnected) {
      this.state.flightInfo.wifiConnected = true;
      this.state.flightInfo.flightPhase = 'ground_wifi_sync';
      this.state.flightInfo.altitude = '0 ft';
      this.state.flightInfo.flightStatus = 'Aterizat – sincronizare Wi-Fi la sol';
      this.state.flightInfo.groundSyncAt = nowIso();
    }

    const awardedPassengers = [];
    let reviewsProcessed = 0;
    let crewRatingsProcessed = 0;
    let totalPointsAwarded = 0;

    const award = (passengerId, amount, source) => {
      const passenger = this.getPassengerById(passengerId);
      if (!passenger) return null;
      passenger.points = (passenger.points || 0) + amount;
      totalPointsAwarded += amount;
      const entry = awardedPassengers.find((a) => a.passengerId === passenger._id);
      if (entry) {
        entry.pointsAdded += amount;
        entry.newBalance = passenger.points;
        entry.sources.push(source);
      } else {
        awardedPassengers.push({
          passengerId: passenger._id,
          name: passenger.name,
          seatNumber: passenger.seatNumber,
          pointsAdded: amount,
          newBalance: passenger.points,
          sources: [source]
        });
      }
      return passenger;
    };

    for (const rating of this.state.ratings) {
      if (rating.pointsAwarded) continue;
      if (award(rating.passengerId, config.POINTS.perReview, 'review')) {
        rating.pointsAwarded = config.POINTS.perReview;
        rating.awardedAt = nowIso();
        reviewsProcessed += 1;
      }
    }

    for (const rating of this.state.passengerRatings) {
      if (rating.pointsAwarded) continue;
      if (award(rating.passengerId, config.POINTS.perCrewRating, 'crew_rating')) {
        rating.pointsAwarded = config.POINTS.perCrewRating;
        rating.awardedAt = nowIso();
        crewRatingsProcessed += 1;
      }
    }

    const syncResult = await sqlServerBridge.executeFullSync(this.state);

    const report = {
      success: true,
      timestamp: nowIso(),
      reviewsProcessed,
      crewRatingsProcessed,
      totalPointsAwarded,
      awardedPassengers,
      bigPeer: syncResult.bigPeer,
      sqlServer: syncResult.sqlServer,
      stats: this.getStats(),
      flightInfo: this.state.flightInfo
    };

    this.emitEvent('GROUND_SYNC_COMPLETED', report, 'syncLog');
    return report;
  }

  getSqlPreview() {
    return sqlServerBridge.buildSyncSql(this.state, 'preview');
  }

  /* ------------------------------------------------------------------ *
   * Demo reset
   * ------------------------------------------------------------------ */

  resetStore() {
    this.state = this.createInitialState();
    this.rebuildSeatMap();
    this.persist('STORE_RESET');
    this.emit('ditto-event', {
      type: 'STORE_RESET',
      collection: 'meta',
      data: { state: this.state },
      timestamp: nowIso()
    });
    return this.state;
  }
}

const engine = new DittoEngine();
engine.ApiError = ApiError;
engine.helpers = { normalizeSeat, clampStars, roundMoney, cleanText, cleanMultiline };
engine.constants = { SERVICE_REQUEST_STATUSES, ORDER_STATUSES, PAYMENT_METHODS };

module.exports = engine;
