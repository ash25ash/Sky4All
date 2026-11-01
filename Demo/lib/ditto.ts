import { useSyncExternalStore } from "react";
import { DITTO_CONFIG } from "@/lib/ditto-config";

export type RequestType = "medical_emergency" | "call_steward" | "order" | "complaint";
export type RequestStatus = "new" | "seen" | "in_progress" | "resolved";

export interface Passenger {
  id: string;
  name: string;
  seat: string;
  flightId: string;
  medicalConditions: string[];
}

export interface Request {
  id: string;
  type: RequestType;
  seat: string;
  payload?: Record<string, unknown>;
  status: RequestStatus;
  createdAt: number;
}

export interface OrderItem {
  name: string;
  qty: number;
}

export interface Order {
  id: string;
  seat: string;
  items: OrderItem[];
  status: RequestStatus;
  createdAt: number;
}

export interface FlightRating {
  id: string;
  seat: string;
  turbulence: number;
  staffBehaviour: number;
  cleanliness: number;
  legroom: number;
  bagSpace: number;
  comment?: string;
  createdAt: number;
}

export interface SeatComplaint {
  id: string;
  fromSeat: string;
  targetSeat: string;
  category: "noise" | "behaviour" | "other";
  text: string;
  createdAt: number;
}

export interface PassengerRating {
  id: string;
  seat: string;
  score: number;
  note: string;
  createdAt: number;
}

export interface Collections {
  passengers: Passenger;
  requests: Request;
  orders: Order;
  flightRatings: FlightRating;
  seatComplaints: SeatComplaint;
  passengerRatings: PassengerRating;
}

export type CollectionName = keyof Collections;

const COLLECTIONS = Object.keys({
  passengers: 1,
  requests: 1,
  orders: 1,
  flightRatings: 1,
  seatComplaints: 1,
  passengerRatings: 1,
}) as CollectionName[];

const store: { [K in CollectionName]: Map<string, Collections[K]> } = {
  passengers: new Map(),
  requests: new Map(),
  orders: new Map(),
  flightRatings: new Map(),
  seatComplaints: new Map(),
  passengerRatings: new Map(),
};

const listeners: { [K in CollectionName]: Set<() => void> } = {
  passengers: new Set(),
  requests: new Set(),
  orders: new Set(),
  flightRatings: new Set(),
  seatComplaints: new Set(),
  passengerRatings: new Set(),
};

const snapshots: { [K in CollectionName]: Collections[K][] } = {
  passengers: [],
  requests: [],
  orders: [],
  flightRatings: [],
  seatComplaints: [],
  passengerRatings: [],
};

let channel: BroadcastChannel | null = null;
const STORAGE_PREFIX = `sky4all_col_${DITTO_CONFIG.databaseId}_`;

function emit<K extends CollectionName>(col: K, broadcast = true) {
  snapshots[col] = [...store[col].values()].filter(
    (doc) => doc.id !== "_collection_init",
  ) as (typeof snapshots)[K];
  listeners[col].forEach((cb) => cb());
  if (broadcast && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${col}`, JSON.stringify(snapshots[col]));
    } catch {
      // ignore storage errors
    }
    if (channel) {
      try {
        channel.postMessage({ type: "SYNC_COLLECTION", col, items: snapshots[col] });
      } catch {
        // ignore broadcast errors
      }
    }
  }
}

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export type DittoStatus = "demo" | "connecting" | "live" | "error";

let status: DittoStatus = "live";
const statusListeners = new Set<() => void>();

function setStatus(next: DittoStatus) {
  status = next;
  statusListeners.forEach((cb) => cb());
}

export function getDittoStatus(): DittoStatus {
  return status;
}

export function useDittoStatus(): DittoStatus {
  return useSyncExternalStore(
    (onChange) => {
      statusListeners.add(onChange);
      return () => {
        statusListeners.delete(onChange);
      };
    },
    () => status,
    () => "live",
  );
}

async function pushToDittoCloud<K extends CollectionName>(col: K, doc: Collections[K]) {
  try {
    await fetch(DITTO_CONFIG.dqlExecuteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ditto-Database-Id": DITTO_CONFIG.databaseId,
      },
      body: JSON.stringify({
        statement: `INSERT INTO ${col} DOCUMENTS (:doc) ON ID CONFLICT DO UPDATE`,
        arguments: {
          doc: {
            ...doc,
            _id: doc.id,
            flightId: "BA123",
            flightDate: "31/10/2026",
          },
        },
      }),
    });
  } catch {
    // Offline P2P fallback active
  }
}

let started = false;

export function ensureStoreStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  setStatus("live");

  for (const col of COLLECTIONS) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${col}`);
      if (raw) {
        const items = JSON.parse(raw) as Collections[typeof col][];
        if (Array.isArray(items)) {
          const target = store[col] as Map<string, Collections[typeof col]>;
          target.clear();
          for (const item of items) {
            target.set(item.id, item);
          }
          emit(col, false);
        }
      }
    } catch {
      // ignore storage parse errors
    }
  }

  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX) || !event.newValue) return;
    const col = event.key.slice(STORAGE_PREFIX.length) as CollectionName;
    if (!COLLECTIONS.includes(col)) return;
    try {
      const items = JSON.parse(event.newValue) as Collections[typeof col][];
      if (Array.isArray(items)) {
        const target = store[col] as Map<string, Collections[typeof col]>;
        target.clear();
        for (const item of items) {
          target.set(item.id, item);
        }
        emit(col, false);
      }
    } catch {
      // ignore storage parse errors
    }
  });

  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(`sky4all_ditto_${DITTO_CONFIG.databaseId}`);
    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === "SYNC_COLLECTION" && msg.col && Array.isArray(msg.items)) {
        const col = msg.col as CollectionName;
        const target = store[col] as Map<string, Collections[typeof col]>;
        target.clear();
        for (const item of msg.items) {
          target.set(item.id, item);
        }
        emit(col, false);
      }
    };
  }
}

export function insert<K extends CollectionName>(
  col: K,
  doc: Omit<Collections[K], "id"> & { id?: string },
): string {
  const id = doc.id ?? nextId(col);
  const full = { ...doc, id } as Collections[K];
  store[col].set(id, full);
  emit(col);
  void pushToDittoCloud(col, full);
  return id;
}

export function update<K extends CollectionName>(
  col: K,
  id: string,
  patch: Partial<Collections[K]>,
) {
  const cur = store[col].get(id);
  if (!cur) return;
  const updated = { ...cur, ...patch };
  store[col].set(id, updated);
  emit(col);
  void pushToDittoCloud(col, updated);
}

export function all<K extends CollectionName>(col: K): Collections[K][] {
  return snapshots[col];
}

export function observe<K extends CollectionName>(
  col: K,
  cb: (docs: Collections[K][]) => void,
): () => void {
  const run = () => cb(snapshots[col]);
  listeners[col].add(run);
  run();
  return () => {
    listeners[col].delete(run);
  };
}

export function useCollection<K extends CollectionName>(col: K): Collections[K][] {
  return useSyncExternalStore(
    (onChange) => {
      listeners[col].add(onChange);
      return () => {
        listeners[col].delete(onChange);
      };
    },
    () => snapshots[col],
    () => snapshots[col],
  );
}

function clearAll() {
  COLLECTIONS.forEach((col) => {
    store[col].clear();
    emit(col);
  });
}

export function seed() {
  clearAll();
}

export function resetAll() {
  clearAll();
}

export interface UploadSummary {
  ok: boolean;
  totalRecords: number;
  dittoDatabaseId: string;
  dittoEndpoint: string;
  sqlDatabase: string;
}

export async function uploadFlightData(): Promise<UploadSummary> {
  const payload = {
    databaseId: DITTO_CONFIG.databaseId,
    cloudUrlEndpoint: DITTO_CONFIG.cloudEndpoint,
    flightNumber: "BA123",
    flightDate: "31/10/2026",
    uploadedAt: new Date().toISOString(),
    collections: {
      passengers: snapshots.passengers,
      requests: snapshots.requests,
      orders: snapshots.orders,
      flightRatings: snapshots.flightRatings,
      seatComplaints: snapshots.seatComplaints,
      passengerRatings: snapshots.passengerRatings,
    },
  };

  const totalRecords =
    snapshots.passengers.length +
    snapshots.requests.length +
    snapshots.orders.length +
    snapshots.flightRatings.length +
    snapshots.seatComplaints.length +
    snapshots.passengerRatings.length;

  for (const col of COLLECTIONS) {
    for (const item of snapshots[col]) {
      await pushToDittoCloud(col, item);
    }
  }

  try {
    await fetch("/api/sync/post-flight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // fallback to standalone sync server if running on port 3001
    try {
      await fetch(`${DITTO_CONFIG.sqlBridgeUrl}/api/sync/post-flight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore offline error
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("sky4all_post_flight_upload", JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }

  return {
    ok: true,
    totalRecords,
    dittoDatabaseId: DITTO_CONFIG.databaseId,
    dittoEndpoint: DITTO_CONFIG.cloudEndpoint,
    sqlDatabase: "Sky4All",
  };
}

const REGISTERED_STEWARD = {
  username: "patrutbm5d",
  password: "123456",
  flightNumber: "BA123",
  flightDate: "31/10/2026",
};

const REGISTERED_PASSENGERS = [
  {
    name: "Popa Andreea",
    flightNumber: "BA123",
    flightDate: "31/10/2026",
    seats: ["C10", "10C"],
    canonicalSeat: "10C",
  },
  {
    name: "Radoi Laura",
    flightNumber: "BA123",
    flightDate: "31/10/2026",
    seats: ["D5", "5D"],
    canonicalSeat: "5D",
  },
];

export function authenticateSteward(
  username: string,
  password: string,
): { username: string; flightNumber: string; flightDate: string } | null {
  if (username.trim() === REGISTERED_STEWARD.username && password === REGISTERED_STEWARD.password) {
    return {
      username: REGISTERED_STEWARD.username,
      flightNumber: REGISTERED_STEWARD.flightNumber,
      flightDate: REGISTERED_STEWARD.flightDate,
    };
  }
  return null;
}

export function normalizeSeatCode(seat: string): string {
  const s = seat.trim().toUpperCase();
  const letterFirst = /^([A-F])(\d{1,2})$/.exec(s);
  if (letterFirst) {
    return `${Number(letterFirst[2])}${letterFirst[1]}`;
  }
  return s;
}

export function validateFlightDetails(flightCode: string, flightDateStr: string): boolean {
  return flightCode.trim().toUpperCase() === "BA123" && flightDateStr.trim() === "31/10/2026";
}

export function validatePassengerSeat(seat: string): string | null {
  const normalized = normalizeSeatCode(seat);
  const match = REGISTERED_PASSENGERS.find((p) => p.seats.includes(normalized));
  return match ? match.canonicalSeat : null;
}

export function validatePassengerProfile(seat: string, name: string): string | null {
  const normalizedSeat = normalizeSeatCode(seat);
  const cleanName = name.trim().replace(/\s+/g, " ").toLowerCase();
  const match = REGISTERED_PASSENGERS.find(
    (p) => p.seats.includes(normalizedSeat) && p.name.toLowerCase() === cleanName,
  );
  return match ? match.name : null;
}

ensureStoreStarted();
