'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const config = require('./config');

/* ----------------------------------------------------------------------------
 * SQL Server bridge
 * ----------------------------------------------------------------------------
 * The in-flight mesh is offline-first: every mutation only touches the local
 * JSON store. This bridge turns the current store into
 *   1. DataFlight_Export.json  – a portable dump of every Ditto collection
 *   2. DataFlight_Sync.sql     – idempotent T-SQL MERGE batch for SSMS
 * and (on touchdown) performs a best-effort Big Peer reachability check.
 * -------------------------------------------------------------------------- */

function sqlText(value) {
  if (value === null || value === undefined) return 'NULL';
  return `N'${String(value).replace(/'/g, "''")}'`;
}

function sqlDateTime(value) {
  if (!value) return 'NULL';
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return sqlText(text);
  return `'${text.replace(/Z$/, '+00:00')}'`;
}

function sqlDate(value) {
  if (!value) return 'NULL';
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `'${text}'` : 'NULL';
}

function sqlNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : String(fallback);
}

function sqlMoney(value) {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toFixed(2);
}

class SqlServerBridge {
  constructor() {
    this.dbName = config.SQL_SERVER.databaseName;
    this.bundledDir = config.SQL_SERVER.bundledDirectory;
    this.mirrorDir = config.SQL_SERVER.mirrorDirectory;
    this.mirrorEnabled = config.SQL_SERVER.mirrorEnabled;
    this.bigPeer = config.DITTO_BIG_PEER;
    this.lastWrite = { bundled: null, mirror: null, error: null };
    this.ensureDirectories();
    this.mirrorSchemaFile();
  }

  ensureDirectories() {
    for (const dir of [this.bundledDir, this.mirrorEnabled ? this.mirrorDir : null]) {
      if (!dir) continue;
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        // Mirroring to Documents\ is optional – never fatal.
      }
    }
  }

  /** Keep Documents\HackathonDB\DataFlight_Schema_and_Seed.sql identical to the bundled one. */
  mirrorSchemaFile() {
    if (!this.mirrorEnabled || !this.mirrorDir) return;
    try {
      const source = path.join(this.bundledDir, config.SQL_SERVER.schemaFile);
      if (!fs.existsSync(source)) return;
      const target = path.join(this.mirrorDir, config.SQL_SERVER.schemaFile);
      fs.copyFileSync(source, target);
    } catch (err) {
      // Non-fatal: the bundled copy is always available.
    }
  }

  writeArtifact(fileName, content) {
    const results = { bundled: null, mirror: null };
    const bundledPath = path.join(this.bundledDir, fileName);
    try {
      fs.writeFileSync(bundledPath, content, 'utf8');
      results.bundled = bundledPath;
    } catch (err) {
      this.lastWrite.error = err.message;
      console.warn('[sql] Could not write', bundledPath, '→', err.message);
    }

    if (this.mirrorEnabled && this.mirrorDir) {
      const mirrorPath = path.join(this.mirrorDir, fileName);
      try {
        fs.writeFileSync(mirrorPath, content, 'utf8');
        results.mirror = mirrorPath;
      } catch (err) {
        results.mirror = null;
      }
    }
    this.lastWrite = { ...results, error: this.lastWrite.error };
    return results;
  }

  collectionCounts(state) {
    return {
      passengers: Object.keys(state.passengers || {}).length,
      crew: (state.crew || []).length,
      serviceRequests: (state.serviceRequests || []).length,
      complaints: (state.complaints || []).length,
      ratings: (state.ratings || []).length,
      seatMap: (state.seatMap || []).length,
      passengerRatings: (state.passengerRatings || []).length,
      orders: (state.orders || []).length
    };
  }

  exportJsonDump(state) {
    const counts = this.collectionCounts(state);
    const payload = {
      generatedAt: new Date().toISOString(),
      dittoBigPeer: {
        appId: this.bigPeer.appId,
        url: this.bigPeer.url,
        endpoint: this.bigPeer.endpoint,
        connected: Boolean(state.flightInfo && state.flightInfo.wifiConnected)
      },
      sqlServer: {
        databaseName: this.dbName,
        bundledDirectory: this.bundledDir,
        mirrorDirectory: this.mirrorEnabled ? this.mirrorDir : null,
        status: state.flightInfo && state.flightInfo.wifiConnected ? 'SYNCED' : 'LOCAL_MESH_ONLY'
      },
      flightInfo: state.flightInfo,
      collections: counts,
      passengers: Object.values(state.passengers || {}),
      crew: (state.crew || []).map(({ pin, ...rest }) => rest),
      serviceRequests: state.serviceRequests || [],
      complaints: state.complaints || [],
      ratings: state.ratings || [],
      seatMap: state.seatMap || [],
      passengerRatings: state.passengerRatings || [],
      orders: state.orders || [],
      syncLog: state.syncLog || []
    };

    const content = JSON.stringify(payload, null, 2);
    const files = this.writeArtifact(config.SQL_SERVER.exportFile, content);
    return { payload, files };
  }

  buildSyncSql(state, reason = 'mutation') {
    const lines = [];
    const counts = this.collectionCounts(state);
    const batchId = `batch_${Date.now().toString(36)}`;
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    lines.push('-- ==============================================================================');
    lines.push('-- SKY4ALL  ->  SQL SERVER SYNC BATCH (Microsoft SQL Server / SSMS)');
    lines.push(`-- DATABASE:      ${this.dbName}`);
    lines.push(`-- GENERATED AT:  ${new Date().toISOString()}`);
    lines.push(`-- TRIGGER:       ${reason}`);
    lines.push(`-- FLIGHT:        ${(state.flightInfo && state.flightInfo.flightNumber) || config.FLIGHT.flightNumber} / ${(state.flightInfo && state.flightInfo.flightDate) || config.FLIGHT.flightDate}`);
    lines.push(`-- BIG PEER:      ${this.bigPeer.url}`);
    lines.push(`-- DATABASE ID:   ${this.bigPeer.appId}`);
    lines.push('-- ==============================================================================');
    lines.push(`USE [${this.dbName}];`);
    lines.push('GO');
    lines.push('');
    lines.push('SET NOCOUNT ON;');
    lines.push('BEGIN TRANSACTION;');
    lines.push('BEGIN TRY');
    lines.push('');

    // 1. Crew -----------------------------------------------------------------
    lines.push('    -- 1/7  dbo.Crew');
    for (const crew of state.crew || []) {
      lines.push('    MERGE dbo.Crew AS Target');
      lines.push(`    USING (SELECT ${sqlText(crew._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(`        UPDATE SET name = ${sqlText(crew.name)}, role = ${sqlText(crew.role)}, flightNumber = ${sqlText(crew.flightNumber)}, flightDate = ${sqlDate(crew.flightDate)}`);
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, name, role, flightNumber, flightDate)');
      lines.push(`        VALUES (${sqlText(crew._id)}, ${sqlText(crew.name)}, ${sqlText(crew.role)}, ${sqlText(crew.flightNumber)}, ${sqlDate(crew.flightDate)});`);
    }
    lines.push('');

    // 2. Passengers -----------------------------------------------------------
    lines.push('    -- 2/7  dbo.Passengers');
    for (const p of Object.values(state.passengers || {})) {
      lines.push('    MERGE dbo.Passengers AS Target');
      lines.push(`    USING (SELECT ${sqlText(p._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET name = ${sqlText(p.name)}, seatNumber = ${sqlText(p.seatNumber)}, flightNumber = ${sqlText(p.flightNumber)}, ` +
          `flightDate = ${sqlDate(p.flightDate)}, medicalConditions = ${sqlText(JSON.stringify(p.medicalConditions || []))}, ` +
          `allergies = ${sqlText(p.allergies || '')}, specialNeeds = ${sqlText(p.specialNeeds || '')}, points = ${sqlNumber(p.points)}, ` +
          'lastSyncedAt = SYSDATETIMEOFFSET()'
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, name, seatNumber, flightNumber, flightDate, medicalConditions, allergies, specialNeeds, points, createdAt)');
      lines.push(
        `        VALUES (${sqlText(p._id)}, ${sqlText(p.name)}, ${sqlText(p.seatNumber)}, ${sqlText(p.flightNumber)}, ${sqlDate(p.flightDate)}, ` +
          `${sqlText(JSON.stringify(p.medicalConditions || []))}, ${sqlText(p.allergies || '')}, ${sqlText(p.specialNeeds || '')}, ` +
          `${sqlNumber(p.points)}, ${sqlDateTime(p.createdAt || new Date().toISOString())});`
      );
    }
    lines.push('');

    // 3. SeatMap --------------------------------------------------------------
    lines.push('    -- 3/7  dbo.SeatMap');
    for (const seat of state.seatMap || []) {
      lines.push('    MERGE dbo.SeatMap AS Target');
      lines.push(`    USING (SELECT ${sqlText(seat._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET seatNumber = ${sqlText(seat.seatNumber)}, [row] = ${sqlNumber(seat.row)}, [column] = ${sqlText(seat.column)}, ` +
          `type = ${sqlText(seat.type)}, status = ${sqlText(seat.status)}, passengerId = ${sqlText(seat.passengerId)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, seatNumber, [row], [column], type, status, passengerId)');
      lines.push(
        `        VALUES (${sqlText(seat._id)}, ${sqlText(seat.seatNumber)}, ${sqlNumber(seat.row)}, ${sqlText(seat.column)}, ` +
          `${sqlText(seat.type)}, ${sqlText(seat.status)}, ${sqlText(seat.passengerId)});`
      );
    }
    lines.push('');

    // 4. ServiceRequests ------------------------------------------------------
    lines.push('    -- 4/7  dbo.ServiceRequests (calls + medical emergencies)');
    for (const req of state.serviceRequests || []) {
      const assigned = req.assignedCrew ? sqlText(req.assignedCrew) : 'NULL';
      lines.push('    MERGE dbo.ServiceRequests AS Target');
      lines.push(`    USING (SELECT ${sqlText(req._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET status = ${sqlText(req.status)}, assignedCrew = ${assigned}, passengerName = ${sqlText(req.passengerName || '')}, ` +
          `details = ${sqlText(req.details)}, priority = ${sqlText(req.priority || 'normal')}, ` +
          `acknowledgedAt = ${sqlDateTime(req.acknowledgedAt)}, resolvedAt = ${sqlDateTime(req.resolvedAt)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, passengerId, passengerName, seatNumber, type, priority, details, status, assignedCrew, createdAt, acknowledgedAt, resolvedAt)');
      lines.push(
        `        VALUES (${sqlText(req._id)}, ${sqlText(req.passengerId)}, ${sqlText(req.passengerName || '')}, ${sqlText(req.seatNumber)}, ` +
          `${sqlText(req.type)}, ${sqlText(req.priority || 'normal')}, ${sqlText(req.details)}, ${sqlText(req.status)}, ${assigned}, ` +
          `${sqlDateTime(req.createdAt)}, ${sqlDateTime(req.acknowledgedAt)}, ${sqlDateTime(req.resolvedAt)});`
      );
    }
    lines.push('');

    // 5. Complaints -----------------------------------------------------------
    lines.push('    -- 5/7  dbo.Complaints');
    for (const comp of state.complaints || []) {
      lines.push('    MERGE dbo.Complaints AS Target');
      lines.push(`    USING (SELECT ${sqlText(comp._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET status = ${sqlText(comp.status || 'filed')}, description = ${sqlText(comp.description)}, ` +
          `category = ${sqlText(comp.category)}, targetSeat = ${sqlText(comp.targetSeat)}, resolvedAt = ${sqlDateTime(comp.resolvedAt)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, reporterId, reporterSeat, targetSeat, category, description, status, createdAt)');
      lines.push(
        `        VALUES (${sqlText(comp._id)}, ${sqlText(comp.reporterId)}, ${sqlText(comp.reporterSeat || '')}, ${sqlText(comp.targetSeat)}, ` +
          `${sqlText(comp.category)}, ${sqlText(comp.description)}, ${sqlText(comp.status || 'filed')}, ${sqlDateTime(comp.createdAt)});`
      );
    }
    lines.push('');

    // 6. Ratings + PassengerRatings ------------------------------------------
    lines.push('    -- 6/7  dbo.Ratings + dbo.PassengerRatings');
    for (const r of state.ratings || []) {
      const overall = Number(r.overall) || Math.round(
        (Number(r.disturbances) + Number(r.staffBehavior) + Number(r.cleanliness) + Number(r.legRoom) + Number(r.baggageSpace)) / 5
      );
      lines.push('    MERGE dbo.Ratings AS Target');
      lines.push(`    USING (SELECT ${sqlText(r._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET disturbances = ${sqlNumber(r.disturbances)}, staffBehavior = ${sqlNumber(r.staffBehavior)}, ` +
          `cleanliness = ${sqlNumber(r.cleanliness)}, legRoom = ${sqlNumber(r.legRoom)}, baggageSpace = ${sqlNumber(r.baggageSpace)}, ` +
          `overall = ${sqlNumber(overall)}, comment = ${sqlText(r.comment || '')}, ` +
          `pointsAwarded = ${r.pointsAwarded ? sqlNumber(r.pointsAwarded) : 'NULL'}, ` +
          `awardedAt = ${sqlDateTime(r.awardedAt)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, passengerId, seatNumber, disturbances, staffBehavior, cleanliness, legRoom, baggageSpace, overall, comment, submittedAt, pointsAwarded, awardedAt)');
      lines.push(
        `        VALUES (${sqlText(r._id)}, ${sqlText(r.passengerId)}, ${sqlText(r.seatNumber || '')}, ${sqlNumber(r.disturbances)}, ` +
          `${sqlNumber(r.staffBehavior)}, ${sqlNumber(r.cleanliness)}, ${sqlNumber(r.legRoom)}, ${sqlNumber(r.baggageSpace)}, ` +
          `${sqlNumber(overall)}, ${sqlText(r.comment || '')}, ${sqlDateTime(r.submittedAt)}, ` +
          `${r.pointsAwarded ? sqlNumber(r.pointsAwarded) : 'NULL'}, ${sqlDateTime(r.awardedAt)});`
      );
    }
    for (const pr of state.passengerRatings || []) {
      lines.push('    MERGE dbo.PassengerRatings AS Target');
      lines.push(`    USING (SELECT ${sqlText(pr._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET score = ${sqlNumber(pr.score)}, note = ${sqlText(pr.note || '')}, ` +
          `pointsAwarded = ${pr.pointsAwarded ? sqlNumber(pr.pointsAwarded) : 'NULL'}, awardedAt = ${sqlDateTime(pr.awardedAt)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, passengerId, seatNumber, crewId, score, note, createdAt, pointsAwarded, awardedAt)');
      lines.push(
        `        VALUES (${sqlText(pr._id)}, ${sqlText(pr.passengerId)}, ${sqlText(pr.seatNumber || '')}, ${sqlText(pr.crewId)}, ` +
          `${sqlNumber(pr.score)}, ${sqlText(pr.note || '')}, ${sqlDateTime(pr.createdAt)}, ` +
          `${pr.pointsAwarded ? sqlNumber(pr.pointsAwarded) : 'NULL'}, ${sqlDateTime(pr.awardedAt)});`
      );
    }
    lines.push('');

    // 7. Orders + sync audit ---------------------------------------------------
    lines.push('    -- 7/7  dbo.Orders + dbo.DittoSyncLog');
    for (const order of state.orders || []) {
      const itemsJson = JSON.stringify(order.items || []);
      const assigned = order.assignedCrew ? sqlText(order.assignedCrew) : 'NULL';
      lines.push('    MERGE dbo.Orders AS Target');
      lines.push(`    USING (SELECT ${sqlText(order._id)} AS _id) AS Source ON Target._id = Source._id`);
      lines.push('    WHEN MATCHED THEN');
      lines.push(
        `        UPDATE SET status = ${sqlText(order.status)}, assignedCrew = ${assigned}, totalRon = ${sqlMoney(order.totalRon)}, ` +
          `totalPoints = ${sqlNumber(order.totalPoints)}, itemsJson = ${sqlText(itemsJson)}, updatedAt = ${sqlDateTime(order.updatedAt)}`
      );
      lines.push('    WHEN NOT MATCHED THEN');
      lines.push('        INSERT (_id, passengerId, seatNumber, paymentMethod, itemsJson, totalRon, totalPoints, status, assignedCrew, createdAt, updatedAt)');
      lines.push(
        `        VALUES (${sqlText(order._id)}, ${sqlText(order.passengerId)}, ${sqlText(order.seatNumber)}, ${sqlText(order.paymentMethod)}, ` +
          `${sqlText(itemsJson)}, ${sqlMoney(order.totalRon)}, ${sqlNumber(order.totalPoints)}, ${sqlText(order.status)}, ${assigned}, ` +
          `${sqlDateTime(order.createdAt)}, ${sqlDateTime(order.updatedAt)});`
      );
    }

    lines.push('');
    lines.push('    INSERT INTO dbo.DittoSyncLog (syncBatchId, bigPeerAppId, bigPeerUrl, recordsPushed, recordsPulled, status)');
    lines.push(
      `    VALUES (${sqlText(batchId)}, ${sqlText(this.bigPeer.appId)}, ${sqlText(this.bigPeer.url)}, ${totalRecords}, 0, ` +
        `${sqlText(state.flightInfo && state.flightInfo.wifiConnected ? 'SYNCED' : 'LOCAL_MESH_ONLY')});`
    );
    lines.push('');
    lines.push('    COMMIT TRANSACTION;');
    lines.push("    PRINT 'Sky4All: T-SQL sync batch applied successfully.';");
    lines.push('END TRY');
    lines.push('BEGIN CATCH');
    lines.push('    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;');
    lines.push('    THROW;');
    lines.push('END CATCH');
    lines.push('GO');
    lines.push('');
    lines.push('-- ============================================================');
    lines.push('-- Collection counts in this batch:');
    for (const [name, count] of Object.entries(counts)) {
      lines.push(`--   ${name.padEnd(18)} ${count}`);
    }
    lines.push('-- ============================================================');

    return lines.join('\n');
  }

  generateSyncSql(state, reason = 'mutation') {
    const sql = this.buildSyncSql(state, reason);
    const files = this.writeArtifact(config.SQL_SERVER.syncFile, sql);
    return { sql, files };
  }

  pingBigPeer(timeoutMs = 3000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve({
          appId: this.bigPeer.appId,
          url: this.bigPeer.url,
          endpoint: this.bigPeer.endpoint,
          timestamp: new Date().toISOString(),
          ...result
        });
      };

      let target;
      try {
        target = new URL(this.bigPeer.url);
      } catch (err) {
        return finish({ connected: false, error: 'Invalid Big Peer URL', detail: err.message });
      }

      const req = https.request(
        {
          hostname: target.hostname,
          port: target.port || 443,
          path: `/${this.bigPeer.appId}`,
          method: 'GET',
          timeout: timeoutMs,
          headers: { Accept: 'application/json', 'User-Agent': 'Sky4All-GroundSync/2.0' }
        },
        (res) => {
          res.resume();
          const connected = res.statusCode >= 200 && res.statusCode < 500;
          finish({
            connected,
            statusCode: res.statusCode,
            mode: connected ? 'big_peer_reachable' : 'big_peer_error',
            note: connected
              ? 'Big Peer endpoint answered – CRDT batch can be pushed.'
              : `Big Peer answered with HTTP ${res.statusCode}.`
          });
        }
      );

      req.on('error', (err) => {
        finish({ connected: false, mode: 'offline_queued', error: err.message, note: 'No network reachability – batch kept for retry.' });
      });
      req.on('timeout', () => {
        req.destroy();
        finish({ connected: false, mode: 'offline_queued', timeout: true, note: 'Big Peer timed out – batch kept for retry.' });
      });
      req.end();
    });
  }

  async executeFullSync(state) {
    const batchId = `batch_${Date.now().toString(36)}`;
    const counts = this.collectionCounts(state);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    const bigPeerPing = await this.pingBigPeer();

    const status = bigPeerPing.connected ? 'SYNCED' : 'QUEUED_OFFLINE';

    state.syncLog = Array.isArray(state.syncLog) ? state.syncLog : [];
    state.syncLog.unshift({
      syncBatchId: batchId,
      bigPeerAppId: this.bigPeer.appId,
      bigPeerUrl: this.bigPeer.url,
      recordsPushed: totalRecords,
      recordsPulled: 0,
      status,
      syncedAt: new Date().toISOString()
    });
    if (state.syncLog.length > 50) state.syncLog.length = 50;

    const artifacts = this.generateSyncSql(state, 'ground_sync');
    const dump = this.exportJsonDump(state);

    return {
      batchId,
      bigPeer: {
        appId: this.bigPeer.appId,
        url: this.bigPeer.url,
        endpoint: this.bigPeer.endpoint,
        status: bigPeerPing.connected ? 'CONNECTED' : 'QUEUED_OFFLINE',
        reachable: bigPeerPing.connected,
        details: bigPeerPing
      },
      sqlServer: {
        databaseName: this.dbName,
        status: 'SYNCED_ON_TOUCHDOWN',
        recordsPushed: totalRecords,
        counts,
        bundledDirectory: this.bundledDir,
        mirrorDirectory: this.mirrorEnabled ? this.mirrorDir : null,
        schemaScript: path.join(this.bundledDir, config.SQL_SERVER.schemaFile),
        syncScript: path.join(this.bundledDir, config.SQL_SERVER.syncFile),
        jsonDump: path.join(this.bundledDir, config.SQL_SERVER.exportFile),
        files: { ...artifacts.files, ...dump.files }
      }
    };
  }
}

module.exports = new SqlServerBridge();
