Sky4All 
Sky4All este o aplicație web care leagă pasagerii și stewardesele în timpul zborului, prin platforma Ditto(opens in a new tab). Există două aplicații, una pe telefonul pasagerului, una pe tableta stewardesei — sincronizate live.

Aplicația are două moduri de rulare:

Ditto live — când completezi cheile din src/lib/ditto-config.ts, aplicația se conectează la Ditto real (SDK oficial v5, sincronizare prin cloud-ul Ditto). Deschizi aplicația pe două dispozitive diferite și cererile circulă real între ele.
Demo simulat — cât timp cheile nu sunt completate, un magazin local imită Ditto, ca să vezi instant toate funcțiile într-un singur browser.
Un indicator din colțul header-ului arată mereu modul curent („Demo simulat" / „Se conectează la Ditto…" / „Ditto live").

Ce poate face aplicația
Pasagerul (telefon)
Se „înscrie" în zbor: nume + loc în avion (cu harta scaunelor)
Selectează condiții medicale (astm, diabet etc.)
Trimite urgență medicală sau apelează o stewardesă
Comandă gustări și băuturi dintr-un meniu cu poze (Coca-Cola, Fanta, evian, Lay's, Oreo, Snickers)
Evaluează zborul: turbulențe, comportamentul echipajului, curățenie, spațiu pentru picioare, spațiu pentru bagaje
Reclamă un alt pasager (zgomot, comportament) selectând scaunul pe hartă
Stewardesa (tabletă)
Vede toate cererile ca notificări pe taburi (urgențe, apeluri, comenzi, reclamații), cu contor de elemente noi
Hartă a cabinei colorată după starea fiecărui scaun
Schimbă starea cererilor: nou → văzut → în lucru → rezolvat
Evaluează pasagerii
Panou de simulare
Butoane care generează evenimente aleatorii (urgențe, apeluri, comenzi) ca să vezi cum reacționează tableta stewardesei.

Cum rulezi aplicația local
Ai nevoie de Node.js(opens in a new tab) (sau Bun) instalat.

npm install
npm run dev
Deschide apoi http://localhost:8080(opens in a new tab) în browser.

/ — ecran împărțit: pasager + stewardesă alăturat
/p — aceeași vedere împărțită
/s — doar interfața stewardesei
Pe Windows, dacă PowerShell refuză npm cu o eroare de securitate, rulează o dată:

Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
Conectarea la Ditto real
Creează un cont gratuit pe portal.ditto.live(opens in a new tab) și o aplicație nouă (New App).
Din ecranul „Connect via SDK" copiază Database ID și URL-ul complet al serverului.
Din Authentication → Online Playground copiază Playground Token.
Completează cele trei valori în src/lib/ditto-config.ts:
export const DITTO_CONFIG = {
  databaseId: "965957f9-6fd7-4d2f-8794-d8f1544c5724",
  serverUrl: "https://i83inp.cloud.dittolive.app",
};
Repornește npm run dev. Indicatorul din header trebuie să arate „Ditto live". Deschide aplicația pe telefon și pe alt dispozitiv — cererile se sincronizează real prin cloud-ul Ditto.
Cheile playground sunt credențiale de client, făcute să fie puse în aplicație (ca la Firebase). Pentru producție se folosește un provider de autentificare propriu în locul token-ului playground.

Cum funcționează pe avion (fără internet)
SDK-ul Ditto din browser sincronizează prin WebSocket. Pe avion, fără internet, este nevoie de un dispozitiv din rețeaua locală (de ex. un laptop al echipajului) care să ruleze Ditto Server și să țină legătura — nu este nevoie de Raspberry Pi. După aterizare, același Ditto sincronizează datele către cloud automat.

Structura proiectului
src/
├── lib/
│   ├── ditto.ts         # Stratul de date: Ditto real + fallback demo
│   ├── ditto-config.ts  # Cheile Ditto (de completat din portal)
│   └── i18n.tsx         # Traduceri română / engleză
├── components/
│   ├── SplitDemo.tsx    # Ecranul împărțit (pasager + stewardesă)
│   ├── PassengerApp.tsx # Interfața pasagerului
│   ├── StewardApp.tsx   # Interfața stewardesei
│   ├── OrderMenu.tsx    # Meniul de gustări și băuturi (cu poze)
│   ├── SeatMap.tsx      # Harta scaunelor din cabină
│   └── SimulatePanel.tsx
├── routes/              # Paginile: /, /p, /s
└── assets/              # Fotografiile produselor + pointerul către ditto.wasm
Stratul de date (src/lib/ditto.ts)
Aceeași interfață în ambele moduri:

insert(colecție, document) — adaugă un document
update(colecție, id, modificări) — actualizează un document
observe(colecție, callback) / useCollection(colecție) — ascultă modificările și re-desenează ecranul instant
useDittoStatus() — starea conexiunii (demo / connecting / live / error)
Colecțiile: passengers, requests, orders, flightRatings, seatComplaints, passengerRatings.

Limitări cunoscute
În browser, baza de date Ditto este doar în memorie — la închiderea tabului datele locale se pierd (documentație oficială Ditto).
Modul live cere internet (sincronizare prin cloud-ul Ditto); pentru folosire pe avion vezi secțiunea de mai sus.
Pozele produselor sunt ilustrative.
Nu există autentificare reală a pasagerilor, plăți sau încărcare separată a datelor după aterizare.
Tehnologii:
TanStack Start(opens in a new tab) (React 19 + Vite)
Ditto JS SDK v5(opens in a new tab)
TypeScript
Tailwind CSS v4 + shadcn/ui
Construit cu Lovable
