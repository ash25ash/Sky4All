import { useSyncExternalStore } from "react";

export type Lang = "en" | "ro";

const dict = {
  en: {
    appName: "Sky4All",
    flightDetected: "Flight RO361 detected nearby, join?",
    join: "Join",
    enterManually: "Enter flight code manually",
    flightCodePlaceholder: "e.g. RO361",
    continue: "Continue",
    selectSeat: "Select your seat",
    row: "Row",
    letter: "Letter",
    useBoardingPass: "Use my boarding pass seat",
    yourProfile: "Your profile (optional)",
    name: "Name",
    medicalConditions: "Medical conditions",
    diabetes: "Diabetes",
    asthma: "Asthma",
    heartCondition: "Heart condition",
    epilepsy: "Epilepsy",
    pregnancy: "Pregnancy",
    allergies: "Allergies",
    none: "None",
    save: "Save",
    skip: "Skip",
    medicalEmergency: "Medical emergency",
    confirmEmergency: "Tap again to confirm the medical emergency",
    callSteward: "Call a steward",
    orderSnacks: "Order snacks & drinks",
    rateFlight: "Rate the flight",
    seatMap: "Seat map",
    cart: "Cart",
    sendOrder: "Send order",
    orderSent: "Order sent to the crew",
    yourRequests: "Your requests",
    statusSent: "Sent over air",
    statusSeen: "Seen by steward",
    statusInProgress: "In progress",
    statusResolved: "Resolved",
    turbulence: "Turbulence",
    staffBehaviour: "Staff behaviour",
    cleanliness: "Cleanliness",
    legroom: "Legroom",
    bagSpace: "Bag space",
    comment: "Comment (optional)",
    submitRating: "Submit rating",
    thanks: "Thank you for your feedback!",
    complaintAbout: "Complaint about seat",
    noise: "Noise",
    behaviour: "Behaviour",
    other: "Other",
    describe: "Describe the issue",
    send: "Send",
    cancel: "Cancel",
    tapSeatToComplain: "Tap a seat to file a complaint. Your seat is highlighted.",
    back: "Back",
    yourSeat: "Your seat",
    urgent: "Urgent",
    calls: "Calls",
    orders: "Orders",
    complaints: "Complaints",
    seen: "Seen",
    inProgress: "In progress",
    resolved: "Resolved",
    markSeen: "Mark seen",
    startProgress: "Start",
    resolve: "Resolve",
    ratePassenger: "Rate passenger",
    score: "Score",
    note: "Note",
    endFlight: "End flight & upload",
    uploading: "Uploading to server…",
    uploadComplete: "Flight data uploaded successfully",
    requestsFor: "Seat",
    medicalLabel: "Medical conditions",
    ratingHistory: "Rating history",
    noData: "Nothing here yet",
    simulate: "Simulate",
    simMedical: "Medical emergency",
    simCall: "Call steward",
    simOrder: "Order",
    simComplaint: "Seat complaint",
    simBadReview: "Very bad review",
    reset: "Reset",
    passenger: "Passenger",
    steward: "Steward",
    openPassenger: "Open passenger view",
    openSteward: "Open steward view",
    liveDemo: "Live demo — both screens share one mock Ditto store",
    emptyTab: "No items",
    avg: "avg",
  },
  ro: {
    appName: "Sky4All",
    flightDetected: "Zborul RO361 a fost detectat în apropiere, te alături?",
    join: "Alătură-te",
    enterManually: "Introdu codul zborului manual",
    flightCodePlaceholder: "ex. RO361",
    continue: "Continuă",
    selectSeat: "Alege locul tău",
    row: "Rând",
    letter: "Literă",
    useBoardingPass: "Folosește locul de pe cartea de îmbarcare",
    yourProfile: "Profilul tău (opțional)",
    name: "Nume",
    medicalConditions: "Condiții medicale",
    diabetes: "Diabet",
    asthma: "Astm",
    heartCondition: "Afecțiuni cardiace",
    epilepsy: "Epilepsie",
    pregnancy: "Sarcină",
    allergies: "Alergii",
    none: "Niciuna",
    save: "Salvează",
    skip: "Omite",
    medicalEmergency: "Urgență medicală",
    confirmEmergency: "Apasă din nou pentru a confirma urgența medicală",
    callSteward: "Cheamă un steward",
    orderSnacks: "Comandă gustări și băuturi",
    rateFlight: "Evaluează zborul",
    seatMap: "Harta locurilor",
    cart: "Coș",
    sendOrder: "Trimite comanda",
    orderSent: "Comanda a fost trimisă echipajului",
    yourRequests: "Cererile tale",
    statusSent: "Trimisă prin aer",
    statusSeen: "Văzută de steward",
    statusInProgress: "În lucru",
    statusResolved: "Rezolvată",
    turbulence: "Turbulențe",
    staffBehaviour: "Comportamentul personalului",
    cleanliness: "Curățenie",
    legroom: "Spațiu pentru picioare",
    bagSpace: "Spațiu pentru bagaje",
    comment: "Comentariu (opțional)",
    submitRating: "Trimite evaluarea",
    thanks: "Mulțumim pentru feedback!",
    complaintAbout: "Reclamație pentru locul",
    noise: "Zgomot",
    behaviour: "Comportament",
    other: "Altele",
    describe: "Descrie problema",
    send: "Trimite",
    cancel: "Anulează",
    tapSeatToComplain: "Atinge un loc pentru a face o reclamație. Locul tău este evidențiat.",
    back: "Înapoi",
    yourSeat: "Locul tău",
    urgent: "Urgente",
    calls: "Apeluri",
    orders: "Comenzi",
    complaints: "Reclamații",
    seen: "Văzut",
    inProgress: "În lucru",
    resolved: "Rezolvat",
    markSeen: "Marchează văzut",
    startProgress: "Începe",
    resolve: "Rezolvă",
    ratePassenger: "Evaluează pasagerul",
    score: "Scor",
    note: "Notă",
    endFlight: "Încheie zborul și încarcă",
    uploading: "Se încarcă pe server…",
    uploadComplete: "Datele zborului au fost încărcate cu succes",
    requestsFor: "Locul",
    medicalLabel: "Condiții medicale",
    ratingHistory: "Istoric evaluări",
    noData: "Nimic aici încă",
    simulate: "Simulare",
    simMedical: "Urgență medicală",
    simCall: "Apel steward",
    simOrder: "Comandă",
    simComplaint: "Reclamație loc",
    simBadReview: "Recenzie foarte proastă",
    reset: "Resetează",
    passenger: "Pasager",
    steward: "Steward",
    openPassenger: "Deschide vizualizarea pasagerului",
    openSteward: "Deschide vizualizarea stewardului",
    liveDemo: "Demo live — ambele ecrane împart același store Ditto simulat",
    emptyTab: "Niciun element",
    avg: "medie",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

let lang: Lang = "en";
const subs = new Set<() => void>();

export function setLang(l: Lang) {
  lang = l;
  subs.forEach((cb) => cb());
}

export function getLang(): Lang {
  return lang;
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => lang,
    () => lang,
  );
}

export function useT() {
  const l = useLang();
  return (key: TKey) => dict[l][key] ?? key;
}

export function LangSwitcher({ className = "" }: { className?: string }) {
  const l = useLang();
  return (
    <div className={`inline-flex overflow-hidden rounded-full border border-border bg-card text-xs font-semibold ${className}`}>
      {(["en", "ro"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-3 py-1 uppercase transition-colors ${
            l === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
