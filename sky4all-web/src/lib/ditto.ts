// ============================================================================
// Mock Ditto module — swap this file for the real Ditto SDK in production.
// Same surface: insert / update / observe. Data lives in memory and changes
// propagate instantly to every observer (simulating Ditto's P2P sync).
// ============================================================================
import { useSyncExternalStore } from "react";

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

function emit<K extends CollectionName>(col: K) {
  snapshots[col] = [...store[col].values()] as (typeof snapshots)[K];
  listeners[col].forEach((cb) => cb());
}

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

/** Insert a document. Returns the generated id. */
export function insert<K extends CollectionName>(
  col: K,
  doc: Omit<Collections[K], "id"> & { id?: string },
): string {
  const id = doc.id ?? nextId(col);
  store[col].set(id, { ...doc, id } as Collections[K]);
  emit(col);
  return id;
}

/** Patch a document by id. */
export function update<K extends CollectionName>(
  col: K,
  id: string,
  patch: Partial<Collections[K]>,
) {
  const cur = store[col].get(id);
  if (!cur) return;
  store[col].set(id, { ...cur, ...patch });
  emit(col);
}

/** Read all documents in a collection (snapshot). */
export function all<K extends CollectionName>(col: K): Collections[K][] {
  return snapshots[col];
}

/**
 * Observe a collection. Callback fires immediately with current docs and again
 * on every change — mirrors Ditto's `.observe()`. Returns an unsubscribe fn.
 */
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

/** React hook: live collection, re-renders on every change. */
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

// ---------------------------------------------------------------------------
// Seed + reset
// ---------------------------------------------------------------------------

function clearAll() {
  (Object.keys(store) as CollectionName[]).forEach((col) => store[col].clear());
}

export function seed() {
  clearAll();
  const now = Date.now();

  insert("passengers", {
    id: "p_maria",
    name: "Maria Ionescu",
    seat: "3A",
    flightId: "RO361",
    medicalConditions: ["asthma"],
  });
  insert("passengers", {
    id: "p_andrei",
    name: "Andrei Pop",
    seat: "7C",
    flightId: "RO361",
    medicalConditions: [],
  });
  insert("passengers", {
    id: "p_elena",
    name: "Elena Dumitru",
    seat: "22B",
    flightId: "RO361",
    medicalConditions: ["diabetes", "heart condition"],
  });

  insert("requests", {
    id: "r_call_7c",
    type: "call_steward",
    seat: "7C",
    status: "new",
    createdAt: now - 1000 * 60 * 4,
  });
  insert("requests", {
    id: "r_med_22b",
    type: "medical_emergency",
    seat: "22B",
    payload: { conditions: ["diabetes", "heart condition"] },
    status: "seen",
    createdAt: now - 1000 * 60 * 9,
  });
  insert("requests", {
    id: "r_ord_5e",
    type: "order",
    seat: "5E",
    status: "in_progress",
    createdAt: now - 1000 * 60 * 12,
  });

  insert("orders", {
    id: "o_5e",
    seat: "5E",
    items: [
      { name: "Coffee", qty: 1 },
      { name: "Sandwich", qty: 2 },
    ],
    status: "in_progress",
    createdAt: now - 1000 * 60 * 12,
  });

  insert("seatComplaints", {
    id: "c_12d",
    fromSeat: "12E",
    targetSeat: "12D",
    category: "noise",
    text: "Loud videos without headphones",
    createdAt: now - 1000 * 60 * 20,
  });

  insert("flightRatings", {
    id: "fr_18f",
    seat: "18F",
    turbulence: 1,
    staffBehaviour: 2,
    cleanliness: 2,
    legroom: 1,
    bagSpace: 2,
    comment: "Very bumpy and cramped",
    createdAt: now - 1000 * 60 * 30,
  });
  insert("flightRatings", {
    id: "fr_3a",
    seat: "3A",
    turbulence: 4,
    staffBehaviour: 5,
    cleanliness: 5,
    legroom: 4,
    bagSpace: 4,
    createdAt: now - 1000 * 60 * 45,
  });
}

/** Reset the whole store back to the seeded demo state. */
export function resetAll() {
  seed();
}

seed();
