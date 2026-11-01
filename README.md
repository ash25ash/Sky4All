## Sky4All — In-Flight Passenger & Cabin Crew Communication Platform

**Sky4All** is an offline-first, real-time in-flight communication and cabin management application designed for **Passengers** and **Cabin Crew Members**. It enables seamless onboard interaction during flight using **Ditto Peer-to-Peer (P2P) Mesh** and synchronizes flight manifests, orders, medical alerts, seat complaints, and ratings with **Ditto Big Peer Cloud** and **Microsoft SQL Server (SSMS 22)** before takeoff and after landing.

---

## 1. Application Features

### Passenger Application Features:

- 3-step flight boarding & seat reservation verification (Flight Check-In, Seat Selection, Passenger Profile & Medical/Allergy Onboarding)
- Instant Medical Emergency alerts with specific symptom selection
- One-tap Call a Steward
- 40-item onboard Snacks & Drinks menu with EUR pricing and live cart
- 5-category Flight Rating & review system
- Interactive 30-row Cabin Seat Map for filing seat complaints
- Real-time request status tracker and bilingual (EN / RO) support

### Cabin Crew (Steward) Application Features:

- Crew authentication with automatic Flight Number and Flight Date autofill
- Real-time 4-tab notification center (Urgent, Calls, Orders, Complaints & feedback) with audio chime and visual pulse alerts
- Live color-coded 30-row Cabin Heatmap (OK, Minor, Urgent)
- Interactive Seat Inspection & Passenger Management panel (medical conditions/allergies, request status progression, and passenger rating/notes)
- One-click End flight & upload synchronization to Ditto Big Peer and SQL Server (Sky4All)



## 2. Platforms, Technologies & Programming Languages Used

### Programming Languages
| Language | Role in Project |
| :--- | :--- |
| **Dart** | Cross-platform mobile/tablet/web application (`lib/`) and standalone SQL Server ⇄ Ditto sync server (`backend/sql_ditto_sync_server.dart`). |
| **TypeScript (`.ts` / `.tsx`)** | React web application (`sky4all-split`), Ditto data layer, and Vite SQL Server middleware. |
| **JavaScript (ES2022)** | Standalone browser runtime and cross-tab P2P state synchronization (`web_html/index.html`). |
| **HTML5 & CSS3** | Document structure, responsive mobile/tablet mockups, and keyframe animations. |
| **T-SQL (Transact-SQL)** | Relational database schema, constraints, seed data, and stored procedures for SQL Server Management Studio 22 (`database/Sky4All.sql`). |
| **DQL (Ditto Query Language)** | Document collection creation, upserts (`ON ID CONFLICT DO UPDATE`), and subscriptions for Ditto Big Peer (`database/ditto_collections_setup.dql`). |

### Frameworks, Libraries & Tools
- **Flutter SDK & Material 3**: Cross-platform native UI for Passenger phone and Crew Steward tablet views (`provider`, `http`, `google_fonts`, `ditto_live`).
- **React 19 & TanStack Start / TanStack Router**: File-based routing (`/`, `/p`, `/s`), reactive state management (`useSyncExternalStore`), and SSR/client hydration.
- **Vite**: Fast frontend build tool and development server with custom Node.js middleware (`sky4all-sql-sync`) for direct local SQL Server persistence.
- **Tailwind CSS & Radix UI / shadcn-ui**: Responsive styling, custom aviation color palette, popovers, calendars (`date-fns`), and `lucide-react` iconography.
- **Ditto.live Platform (`@dittolive/ditto` & HTTP DQL API)**: Offline-first CRDT document store, P2P mesh synchronization during flight, and Big Peer cloud sync.
- **Microsoft SQL Server & SSMS 22 (`sqlcmd` ODBC 18)**: Global relational database (`Sky4All`) storing pre-flight manifests, onboard catalog, post-flight records, and audit logs.

### Supported Platforms
- **Web (Desktop & Mobile Browsers)**: Chrome, Edge, Firefox, Safari — supports side-by-side Split View (`/`) as well as multi-tab operation (`/p` for Passenger tab and `/s` for Steward tab).
- **Mobile & Tablet**: Android & iOS (via Flutter).
- **Desktop**: Windows, macOS, and Linux (via Flutter & Web).

---

## 3. Ditto Big Peer Connection Configuration

- **Database ID**: `965957f9-6fd7-4d2f-8794-d8f1544c5724`
- **Cloud URL**: `https://i83inp.cloud.dittolive.app`
- **Cloud URL Endpoint**: `i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724`
- **HTTP DQL Endpoint**: `https://i83inp.cloud.dittolive.app/api/v4/store/execute`

---

## 4. Architecture Breakdown: Frontend, Backend & Database Files

### Frontend — React / TypeScript Web Applications
- `src/components/SplitDemo.tsx` — Side-by-side Passenger phone and Steward tablet view (`/`).
- `src/routes/p.tsx` — Standalone Passenger web view (`/p`).
- `src/routes/s.tsx` — Standalone Crew Steward web view (`/s`).
- `src/components/PassengerApp.tsx` — Complete Passenger onboarding and in-flight interface.
- `src/components/StewardApp.tsx` — Crew Steward login, autofilled flight header, 4-tab notification center, cabin heatmap, seat panel, and post-flight upload button.
- `src/components/OrderMenu.tsx` & `src/lib/menu.ts` — 40-item onboard snack & drink menu with EUR formatting.
- `src/components/SeatMap.tsx` — Interactive 30-row (`A`–`F`) aircraft cabin seat map.
- `src/lib/i18n.tsx` — Bilingual (`EN` / `RO`) translation system.
- `src/lib/ditto-config.ts` & `src/lib/ditto.ts` — Ditto store, cross-tab `BroadcastChannel` + `localStorage` sync, credential validation, and `uploadFlightData()` post-flight sync.

### Frontend — Flutter / Dart Application
- `pubspec.yaml` — Flutter dependencies and bundled image assets (`assets/images/`).
- `lib/main.dart` — Split-screen entrypoint (`Passenger` + `Steward`).
- `lib/main_passenger.dart` — Standalone Passenger app entrypoint.
- `lib/main_steward.dart` — Standalone Crew Steward app entrypoint.
- `lib/screens/split_demo_screen.dart` — Split-screen layout and view switcher.
- `lib/screens/passenger/passenger_app.dart` — Flutter Passenger implementation.
- `lib/screens/steward/steward_app.dart` — Flutter Crew Steward implementation.
- `lib/widgets/order_menu_widget.dart` & `lib/widgets/seat_map_widget.dart` — Reusable menu and seat map widgets.
- `lib/services/i18n_service.dart` & `lib/models/sky4all_models.dart` — Translations, models, and menu catalog.

### Frontend — Standalone HTML Web Version
- `web_html/index.html` — Zero-build HTML5/Tailwind/JS web application.

### Backend & Synchronization Layer
- `vite.config.ts` — Contains the `sky4allSqlSyncPlugin` middleware that writes post-flight data directly to SQL Server (`Sky4All`) via `sqlcmd` when clicking **End flight & upload**.
- `backend/sql_ditto_sync_server.dart` — Standalone Dart HTTP Sync Server (`http://localhost:3001`) bridging Ditto Big Peer and SQL Server (`Sky4All`).
- `lib/services/ditto_service.dart` & `lib/config/ditto_config.dart` — Flutter Ditto DQL & SQL Server sync service.

### Global Database & Ditto Collections
- `database/Sky4All.sql` — T-SQL script for **SQL Server Management Studio 22 (SSMS 22)** creating the `Sky4All` database, 10 tables (`Flights`, `Stewards`, `Passengers`, `Products`, `Requests`, `Orders`, `FlightRatings`, `SeatComplaints`, `PassengerRatings`, `SyncAuditLogs`), seed data, and sync stored procedures (`usp_PreFlightSyncToDitto`, `usp_PostFlightSyncFromDitto`).
- `database/ditto_collections_setup.dql` — DQL statements for initializing the 7 Ditto collections (`passengers`, `stewards`, `requests`, `orders`, `seatComplaints`, `flightRatings`, `passengerRatings`).

---

## 5. How to Run on Localhost

### Run the React / Vite Web Interface (Split View & Multi-Tab)
```cmd
cd C:\Users\PC\Hackathon\Sky4AllDemo\sky4all-split
npm install
npm run dev
```
Open in your browser:
- **Split View (Passenger + Steward side-by-side)**: `http://localhost:8080/`
- **Passenger View in its own tab**: `http://localhost:8080/p`
- **Crew Steward View in its own tab**: `http://localhost:8080/s`


