'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Sky4All – single source of truth for the in-flight platform.
 * Every module (engine, HTTP server, SQL bridge, Ditto connector, web apps)
 * reads from here, so the flight data / menu / points economy can never drift
 * apart again.
 */

const ROOT_DIR = path.join(__dirname, '..');

const FLIGHT = {
  flightNumber: 'BA123',
  airline: 'Sky4All Airways',
  aircraft: 'Airbus A320neo',
  flightDate: '2025-01-15',
  origin: { code: 'LHR', city: 'London Heathrow' },
  destination: { code: 'JFK', city: 'New York JFK' },
  departureTime: '2025-01-15T09:00:00.000Z',
  arrivalTime: '2025-01-15T12:15:00.000Z',
  rows: 24,
  seatLetters: ['A', 'B', 'C', 'D', 'E', 'F'],
  aisleAfterLetter: 'C',
  cruisingAltitude: '36,000 ft'
};

const DITTO_BIG_PEER = {
  appId: process.env.DITTO_APP_ID || '965957f9-6fd7-4d2f-8794-d8f1544c5724',
  url: process.env.DITTO_URL || 'https://i83inp.cloud.dittolive.app',
  wsUrl: process.env.DITTO_WS_URL || 'wss://i83inp.cloud.dittolive.app',
  endpoint:
    process.env.DITTO_ENDPOINT ||
    'i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724'
};

/* --------------------------------------------------------------------------
 * Ditto Cloud authentication
 * ------------------------------------------------------------------------
 * The Ditto Big Peer requires an authenticated identity for "server" mode.
 * Provide a development/auth token in ONE of these places:
 *   1. data/ditto-auth.json   -> { "token": "<jwt>", "provider": "development" }
 *   2. environment variable   -> DITTO_AUTH_TOKEN=...  (DITTO_AUTH_PROVIDER=...)
 * The token is issued in the Ditto portal for this database.
 * ---------------------------------------------------------------------- */
function readDittoAuthFile() {
  const candidates = [
    path.join(ROOT_DIR, 'data', 'ditto-auth.json'),
    path.join(ROOT_DIR, 'ditto-auth.json')
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed.token === 'string') return parsed;
    } catch (err) {
      console.warn('[ditto-cloud] Ignoring unreadable auth file', file, ':', err.message);
    }
  }
  return null;
}

const authFile = readDittoAuthFile();

const DITTO_CLOUD = {
  enabled: process.env.DITTO_CLOUD !== 'false',
  authToken: process.env.DITTO_AUTH_TOKEN || (authFile && authFile.token) || '',
  authProvider:
    process.env.DITTO_AUTH_PROVIDER || (authFile && authFile.provider) || 'development',
  databaseID: DITTO_BIG_PEER.appId,
  url: DITTO_BIG_PEER.wsUrl,
  persistenceDirectory: process.env.DITTO_PERSISTENCE_DIR || path.join(ROOT_DIR, 'data', 'ditto-cloud.ddb'),
  collections: [
    'passengers',
    'crew',
    'serviceRequests',
    'complaints',
    'ratings',
    'seatMap',
    'passengerRatings',
    'orders'
  ]
};

// Points economy (documented in README and exposed to the UI through /api/state).
const POINTS = {
  perReview: 50,
  perCrewRating: 10,
  awardPhase: 'ground_sync'
};

const SQL_SERVER = {
  databaseName: 'DataFlight',
  bundledDirectory: path.join(ROOT_DIR, 'HackathonDB'),
  mirrorDirectory: process.env.SKY4ALL_SQL_DIR || 'C:\\Users\\PC\\Documents\\HackathonDB',
  mirrorEnabled: process.env.SKY4ALL_SQL_MIRROR !== 'false',
  schemaFile: 'DataFlight_Schema_and_Seed.sql',
  syncFile: 'DataFlight_Sync.sql',
  exportFile: 'DataFlight_Export.json'
};

// `icon` values are semantic names consumed by the SVG icon set in the web UI
// (no emoji anywhere in the front-end).
const MEDICAL_CONDITIONS_LIST = [
  { id: 'peanut_allergy', label: 'Alergie la alune / nuci', labelEn: 'Peanut / nut allergy' },
  { id: 'asthma', label: 'Astm / inhalator', labelEn: 'Asthma / inhaler' },
  { id: 'diabetes', label: 'Diabet', labelEn: 'Diabetes' },
  { id: 'cardiac', label: 'Afecțiuni cardiace', labelEn: 'Heart condition' },
  { id: 'epilepsy', label: 'Epilepsie', labelEn: 'Epilepsy / seizures' },
  { id: 'mobility', label: 'Mobilitate redusă', labelEn: 'Reduced mobility' },
  { id: 'pregnancy', label: 'Sarcină', labelEn: 'Pregnancy' },
  { id: 'none', label: 'Fără afecțiuni', labelEn: 'No conditions' }
];

const COMPLAINT_CATEGORIES = [
  { id: 'noise', label: 'Zgomot excesiv / muzică', labelEn: 'Loud noise / music' },
  { id: 'seat_kicking', label: 'Lovituri în scaun', labelEn: 'Seat kicking / reclining' },
  { id: 'unruly_behavior', label: 'Comportament neadecvat', labelEn: 'Unruly behaviour' },
  { id: 'personal_space', label: 'Spațiu personal încălcat', labelEn: 'Personal space invasion' },
  { id: 'overhead_hogging', label: 'Bagaje în culoar / spațiu de bagaj', labelEn: 'Overhead bin hogging' },
  { id: 'other', label: 'Altă problemă', labelEn: 'Other issue' }
];

// priceRon: on-board price in RON. pricePoints: loyalty points price.
// An item with priceRon === 0 can only be redeemed with points.
const MENU_ITEMS = [
  {
    id: 'water_still',
    name: 'Apă minerală 500 ml',
    nameEn: 'Still water 500 ml',
    description: 'Apă plată, rece.',
    descriptionEn: 'Chilled still water.',
    icon: 'cup',
    category: 'drink',
    priceRon: 10,
    pricePoints: 30,
    inStock: true
  },
  {
    id: 'orange_juice',
    name: 'Suc de portocale',
    nameEn: 'Orange juice',
    description: 'Suc natural, 250 ml.',
    descriptionEn: 'Fresh juice, 250 ml.',
    icon: 'cup',
    category: 'drink',
    priceRon: 15,
    pricePoints: 40,
    inStock: true
  },
  {
    id: 'espresso',
    name: 'Cafea espresso',
    nameEn: 'Espresso coffee',
    description: 'Cafea proaspăt preparată.',
    descriptionEn: 'Freshly brewed coffee.',
    icon: 'coffee',
    category: 'drink',
    priceRon: 12,
    pricePoints: 35,
    inStock: true
  },
  {
    id: 'chicken_sandwich',
    name: 'Sandwich pui & cașcaval',
    nameEn: 'Chicken & cheese sandwich',
    description: 'Sandwich rece, 180 g.',
    descriptionEn: 'Cold sandwich, 180 g.',
    icon: 'food',
    category: 'food',
    priceRon: 25,
    pricePoints: 80,
    inStock: true
  },
  {
    id: 'chocolate_croissant',
    name: 'Croissant cu ciocolată',
    nameEn: 'Chocolate croissant',
    description: 'Proaspăt, 90 g.',
    descriptionEn: 'Freshly baked, 90 g.',
    icon: 'food',
    category: 'food',
    priceRon: 12,
    pricePoints: 40,
    inStock: true
  },
  {
    id: 'snack_mix',
    name: 'Mix alune & covrigi',
    nameEn: 'Nut & pretzel mix',
    description: '80 g.',
    descriptionEn: '80 g.',
    icon: 'food',
    category: 'food',
    priceRon: 18,
    pricePoints: 60,
    inStock: false
  },
  {
    id: 'dark_chocolate',
    name: 'Ciocolată neagră',
    nameEn: 'Dark chocolate',
    description: '70% cacao, 50 g.',
    descriptionEn: '70% cocoa, 50 g.',
    icon: 'food',
    category: 'food',
    priceRon: 10,
    pricePoints: 30,
    inStock: true
  },
  {
    id: 'blanket_kit',
    name: 'Kit confort (pătură + pernă)',
    nameEn: 'Comfort kit (blanket + pillow)',
    description: 'Disponibil doar cu puncte.',
    descriptionEn: 'Available with points only.',
    icon: 'gift',
    category: 'reward',
    priceRon: 0,
    pricePoints: 45,
    inStock: true
  }
];

const SERVICE_REQUEST_TYPES = [
  { id: 'drink', label: 'Băutură', labelEn: 'Drink' },
  { id: 'food', label: 'Mâncare', labelEn: 'Food' },
  { id: 'blanket', label: 'Pătură / pernă', labelEn: 'Blanket / pillow' },
  { id: 'assistance', label: 'Asistență stewards', labelEn: 'Cabin assistance' },
  { id: 'other', label: 'Altă solicitare', labelEn: 'Other request' }
];

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT) || 3000,
  APP_NAME: 'Sky4All',
  DATA_FILE: process.env.SKY4ALL_DATA_FILE || path.join(ROOT_DIR, 'data', 'ditto_store.json'),
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  FLIGHT,
  DITTO_BIG_PEER,
  DITTO_CLOUD,
  SQL_SERVER,
  POINTS,
  MEDICAL_CONDITIONS_LIST,
  COMPLAINT_CATEGORIES,
  MENU_ITEMS,
  SERVICE_REQUEST_TYPES
};
