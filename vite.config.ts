import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const execFileAsync = promisify(execFile);

function sqlEsc(val: unknown): string {
  return String(val ?? "").replace(/'/g, "''");
}

async function runSqlQuery(query: string): Promise<void> {
  try {
    await execFileAsync("sqlcmd", [
      "-S",
      "localhost",
      "-d",
      "Sky4All",
      "-E",
      "-C",
      "-Q",
      query,
    ]);
  } catch (err) {
    console.error("[Sky4All SQL Sync] sqlcmd error:", err);
  }
}

function sky4allSqlSyncPlugin(): Plugin {
  return {
    name: "sky4all-sql-sync",
    configureServer(server) {
      server.middlewares.use("/api/sync/pre-flight", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          try {
            await runSqlQuery(
              "EXEC dbo.usp_PreFlightSyncToDitto @FlightNumber = N'BA123', @FlightDate = N'31/10/2026';",
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                phase: "PRE_FLIGHT_SYNC",
                sqlDatabase: "Sky4All",
                flightNumber: "BA123",
                flightDate: "31/10/2026",
              }),
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });

      server.middlewares.use("/api/sync/post-flight", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          try {
            const data = JSON.parse(body || "{}");
            const cols = data.collections || {};
            const passengers = Array.isArray(cols.passengers) ? cols.passengers : [];
            const requests = Array.isArray(cols.requests) ? cols.requests : [];
            const orders = Array.isArray(cols.orders) ? cols.orders : [];
            const ratings = Array.isArray(cols.flightRatings) ? cols.flightRatings : [];
            const complaints = Array.isArray(cols.seatComplaints) ? cols.seatComplaints : [];
            const paxRatings = Array.isArray(cols.passengerRatings) ? cols.passengerRatings : [];

            const statements: string[] = [];

            for (const p of passengers) {
              const id = sqlEsc(p.id);
              const name = sqlEsc(p.name);
              const seat = sqlEsc(p.seat);
              const flightId = sqlEsc(p.flightId || "BA123");
              const medJson = sqlEsc(JSON.stringify(p.medicalConditions || []));
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.Passengers WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.Passengers (Id, Name, Seat, FlightId, FlightDate, MedicalConditionsJson) ` +
                  `VALUES (N'${id}', N'${name}', N'${seat}', N'${flightId}', N'31/10/2026', N'${medJson}') ` +
                  `ELSE UPDATE dbo.Passengers SET MedicalConditionsJson = N'${medJson}', UpdatedAt = SYSUTCDATETIME() WHERE Id = N'${id}';`,
              );
            }

            for (const r of requests) {
              const id = sqlEsc(r.id);
              const type = sqlEsc(r.type);
              const seat = sqlEsc(r.seat);
              const payloadJson = sqlEsc(JSON.stringify(r.payload || {}));
              const status = sqlEsc(r.status || "new");
              const createdAt = Number(r.createdAt) || Date.now();
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.Requests (Id, Type, Seat, FlightId, FlightDate, PayloadJson, Status, CreatedAt) ` +
                  `VALUES (N'${id}', N'${type}', N'${seat}', N'BA123', N'31/10/2026', N'${payloadJson}', N'${status}', ${createdAt}) ` +
                  `ELSE UPDATE dbo.Requests SET Status = N'${status}', SyncedAt = SYSUTCDATETIME() WHERE Id = N'${id}';`,
              );
            }

            for (const o of orders) {
              const id = sqlEsc(o.id);
              const seat = sqlEsc(o.seat);
              const itemsJson = sqlEsc(JSON.stringify(o.items || []));
              const status = sqlEsc(o.status || "new");
              const createdAt = Number(o.createdAt) || Date.now();
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.Orders (Id, Seat, FlightId, FlightDate, ItemsJson, Status, CreatedAt) ` +
                  `VALUES (N'${id}', N'${seat}', N'BA123', N'31/10/2026', N'${itemsJson}', N'${status}', ${createdAt}) ` +
                  `ELSE UPDATE dbo.Orders SET Status = N'${status}', SyncedAt = SYSUTCDATETIME() WHERE Id = N'${id}';`,
              );
            }

            for (const fr of ratings) {
              const id = sqlEsc(fr.id);
              const seat = sqlEsc(fr.seat);
              const turbulence = Math.min(5, Math.max(1, Number(fr.turbulence) || 3));
              const staffBehaviour = Math.min(5, Math.max(1, Number(fr.staffBehaviour) || 3));
              const cleanliness = Math.min(5, Math.max(1, Number(fr.cleanliness) || 3));
              const legroom = Math.min(5, Math.max(1, Number(fr.legroom) || 3));
              const bagSpace = Math.min(5, Math.max(1, Number(fr.bagSpace) || 3));
              const comment = sqlEsc(fr.comment || "");
              const createdAt = Number(fr.createdAt) || Date.now();
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.FlightRatings WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.FlightRatings (Id, Seat, FlightId, FlightDate, Turbulence, StaffBehaviour, Cleanliness, Legroom, BagSpace, Comment, CreatedAt) ` +
                  `VALUES (N'${id}', N'${seat}', N'BA123', N'31/10/2026', ${turbulence}, ${staffBehaviour}, ${cleanliness}, ${legroom}, ${bagSpace}, N'${comment}', ${createdAt});`,
              );
            }

            for (const sc of complaints) {
              const id = sqlEsc(sc.id);
              const fromSeat = sqlEsc(sc.fromSeat);
              const targetSeat = sqlEsc(sc.targetSeat);
              const category = sqlEsc(sc.category || "other");
              const text = sqlEsc(sc.text || "");
              const createdAt = Number(sc.createdAt) || Date.now();
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.SeatComplaints WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.SeatComplaints (Id, FromSeat, TargetSeat, FlightId, FlightDate, Category, Text, CreatedAt) ` +
                  `VALUES (N'${id}', N'${fromSeat}', N'${targetSeat}', N'BA123', N'31/10/2026', N'${category}', N'${text}', ${createdAt});`,
              );
            }

            for (const pr of paxRatings) {
              const id = sqlEsc(pr.id);
              const seat = sqlEsc(pr.seat);
              const score = Math.min(5, Math.max(1, Number(pr.score) || 3));
              const note = sqlEsc(pr.note || "");
              const createdAt = Number(pr.createdAt) || Date.now();
              statements.push(
                `IF NOT EXISTS (SELECT 1 FROM dbo.PassengerRatings WHERE Id = N'${id}') ` +
                  `INSERT INTO dbo.PassengerRatings (Id, Seat, FlightId, FlightDate, Score, Note, CreatedAt) ` +
                  `VALUES (N'${id}', N'${seat}', N'BA123', N'31/10/2026', ${score}, N'${note}', ${createdAt});`,
              );
            }

            const totalRecords =
              passengers.length +
              requests.length +
              orders.length +
              ratings.length +
              complaints.length +
              paxRatings.length;

            statements.push(
              `EXEC dbo.usp_PostFlightSyncFromDitto @FlightNumber = N'BA123', @FlightDate = N'31/10/2026', @RecordsCount = ${totalRecords};`,
            );

            await runSqlQuery(statements.join("\n"));

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                sqlDatabase: "Sky4All",
                recordsSynced: totalRecords,
              }),
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [sky4allSqlSyncPlugin()],
    environments: {
      ssr: {
        resolve: { external: ["@dittolive/ditto"] },
      },
      nitro: {
        resolve: { external: ["@dittolive/ditto"] },
        build: { rollupOptions: { external: ["@dittolive/ditto"] } },
      },
    },
  },
});
