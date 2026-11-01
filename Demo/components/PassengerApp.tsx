import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CalendarIcon,
  ChevronLeft,
  ShoppingCart,
  Star,
  Armchair,
  MessageSquareWarning,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  insert,
  useCollection,
  validateFlightDetails,
  validatePassengerSeat,
  validatePassengerProfile,
  type RequestStatus,
} from "@/lib/ditto";
import { useT, useLang, LangSwitcher, type TKey } from "@/lib/i18n";
import airplaneImg from "@/assets/airplane.png";
import { SeatMap, type SeatStatus } from "@/components/SeatMap";
import { OrderMenu } from "@/components/OrderMenu";

const ALLERGIES: { en: string; ro: string }[] = [
  { en: "Peanuts", ro: "Arahide" },
  { en: "Tree nuts", ro: "Nuci" },
  { en: "Milk / lactose", ro: "Lapte / lactoză" },
  { en: "Eggs", ro: "Ouă" },
  { en: "Gluten", ro: "Gluten" },
  { en: "Soy", ro: "Soia" },
  { en: "Fish", ro: "Pește" },
  { en: "Shellfish", ro: "Fructe de mare" },
  { en: "Sesame", ro: "Susan" },
  { en: "Penicillin", ro: "Penicilină" },
  { en: "Latex", ro: "Latex" },
  { en: "Pollen", ro: "Polen" },
  { en: "Other", ro: "Altele" },
];

const CONDITIONS: TKey[] = [
  "diabetes",
  "asthma",
  "heartCondition",
  "epilepsy",
  "pregnancy",
  "allergies",
  "none",
];

const RATING_CATEGORIES: TKey[] = ["turbulence", "staffBehaviour", "cleanliness", "legroom", "bagSpace"];

const statusLabel: Record<RequestStatus, TKey> = {
  new: "statusSent",
  seen: "statusSeen",
  in_progress: "statusInProgress",
  resolved: "statusResolved",
};

const statusColor: Record<RequestStatus, string> = {
  new: "bg-secondary text-secondary-foreground",
  seen: "bg-accent text-accent-foreground",
  in_progress: "bg-seat-minor text-seat-minor-foreground",
  resolved: "bg-seat-ok text-seat-ok-foreground",
};

type View = "home" | "order" | "rate" | "seatmap";

export function PassengerApp() {
  const t = useT();

  const [flightId, setFlightId] = useState<string | null>(null);
  const [flightDay, setFlightDay] = useState<Date | undefined>();
  const [code, setCode] = useState("");
  const [flightError, setFlightError] = useState("");

  const [seat, setSeat] = useState<string | null>(null);
  const [row, setRow] = useState(1);
  const [letter, setLetter] = useState("A");
  const [seatError, setSeatError] = useState("");

  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<TKey[]>([]);
  const [profileDone, setProfileDone] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [otherAllergy, setOtherAllergy] = useState("");
  const lang = useLang();
  const [otherEmergency, setOtherEmergency] = useState("");

  const [view, setView] = useState<View>("home");
  const [confirmingEmergency, setConfirmingEmergency] = useState(false);
  const [complaintSeat, setComplaintSeat] = useState<string | null>(null);

  const requests = useCollection("requests");
  const myRequests = useMemo(
    () => (seat ? requests.filter((r) => r.seat === seat).sort((a, b) => b.createdAt - a.createdAt) : []),
    [requests, seat],
  );

  if (!flightId) {
    const handleFlightContinue = () => {
      const formattedDate = flightDay ? format(flightDay, "dd/MM/yyyy") : "";
      if (!validateFlightDetails(code, formattedDate)) {
        setFlightError(t("invalidFlight"));
        return;
      }
      setFlightError("");
      setFlightId(code.trim().toUpperCase());
    };

    return (
      <Shell>
        <div className="-mx-3 -mb-3 flex flex-1 flex-col gap-4 overflow-hidden rounded-t-2xl bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-center text-sm font-semibold text-foreground">{t("flightPrompt")}</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("flightNumber")}
              </label>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setFlightError("");
                }}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("flightDay")}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm",
                      !flightDay && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="size-4 shrink-0 opacity-70" />
                    {flightDay ? format(flightDay, "dd/MM/yyyy") : t("pickDay")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    defaultMonth={new Date(2026, 9, 1)}
                    selected={flightDay}
                    onSelect={(d) => {
                      setFlightDay(d);
                      setFlightError("");
                    }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {flightError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
                {flightError}
              </p>
            )}
            <button
              onClick={handleFlightContinue}
              className="mt-1 w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground disabled:opacity-50"
              disabled={!code.trim() || !flightDay}
            >
              {t("continue")}
            </button>
          </div>
          <div className="relative -mx-5 -mb-5 mt-1 min-h-52 flex-1 overflow-hidden">
            <img
              src={airplaneImg}
              alt="Airplane above the clouds"
              className="absolute inset-0 h-full w-full max-w-none object-cover object-center"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent px-4 pb-5 pt-12">
              <p className="text-center text-base font-extrabold uppercase tracking-[0.2em] text-primary-foreground drop-shadow">
                “Your comfort, our priority”
              </p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (!seat) {
    const handleSeatContinue = () => {
      const selected = `${row}${letter}`;
      const validSeat = validatePassengerSeat(selected);
      if (!validSeat) {
        setSeatError(t("invalidSeat"));
        return;
      }
      setSeatError("");
      setSeat(validSeat);
    };

    return (
      <Shell>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">{t("selectSeat")}</h2>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {t("letter")}
              <select
                value={letter}
                onChange={(e) => {
                  setLetter(e.target.value);
                  setSeatError("");
                }}
                className="rounded-xl border border-input bg-background px-3 py-3"
              >
                {["A", "B", "C", "D", "E", "F"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {t("row")}
              <select
                value={row}
                onChange={(e) => {
                  setRow(Number(e.target.value));
                  setSeatError("");
                }}
                className="rounded-xl border border-input bg-background px-3 py-3"
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </label>
          </div>
          {seatError && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
              {seatError}
            </p>
          )}
          <button
            onClick={handleSeatContinue}
            className="rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
          >
            {t("continue")}
          </button>
        </div>
      </Shell>
    );
  }

  if (!profileDone) {
    const toggle = (c: TKey) =>
      setConditions((prev) =>
        c === "none"
          ? ["none"]
          : prev.includes(c)
            ? prev.filter((x) => x !== c)
            : [...prev.filter((x) => x !== "none"), c],
      );
    const finish = () => {
      const validName = validatePassengerProfile(seat, name);
      if (!validName) {
        setProfileError(t("invalidPassengerName"));
        return;
      }
      setProfileError("");
      insert("passengers", {
        name: validName,
        seat,
        flightId,
        medicalConditions: conditions
          .filter((c) => c !== "none")
          .map((c) => {
            if (c !== "allergies") return t(c);
            const list = allergies
              .filter((a) => a !== "Other")
              .map((a) => ALLERGIES.find((x) => x.en === a)![lang]);
            if (allergies.includes("Other") && otherAllergy.trim()) list.push(otherAllergy.trim());
            return list.length ? `${t(c)}: ${list.join(", ")}` : t(c);
          }),
      });
      setProfileDone(true);
    };
    return (
      <Shell>
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          <div className="flex items-center gap-3 bg-primary px-5 py-4 text-primary-foreground">
            <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold leading-tight">
              {name.trim() || t("yourProfile")}
            </h2>
            <div className="flex items-center gap-1 rounded-full bg-primary-foreground/20 px-3 py-1 text-sm font-bold">
              <Armchair className="h-4 w-4" /> {seat}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("name")}</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProfileError("");
                }}
                placeholder={t("name")}
                className="rounded-xl border border-input bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t("medicalConditions")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map((c) => {
                  const on = conditions.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggle(c)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition-colors ${
                        on
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-background text-foreground"
                      } ${c === "none" ? "col-span-2 justify-center" : ""}`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>
                      {t(c)}
                    </button>
                  );
                })}
              </div>
              {conditions.includes("allergies") && (
                <div className="mt-1 flex flex-col gap-2 rounded-xl bg-secondary/60 p-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {lang === "ro" ? "Alege alergiile" : "Choose your allergies"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGIES.map((a) => {
                      const on = allergies.includes(a.en);
                      return (
                        <button
                          key={a.en}
                          onClick={() =>
                            setAllergies((p) => (on ? p.filter((x) => x !== a.en) : [...p, a.en]))
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            on ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-border"
                          }`}
                        >
                          {a[lang]}
                        </button>
                      );
                    })}
                  </div>
                  {allergies.includes("Other") && (
                    <input
                      value={otherAllergy}
                      onChange={(e) => setOtherAllergy(e.target.value)}
                      placeholder={lang === "ro" ? "Scrie alergia..." : "Type your allergy..."}
                      className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}
            </div>

            {profileError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
                {profileError}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={finish}
                className="rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground shadow-sm"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const EMERGENCIES: { en: string; ro: string }[] = [
    { en: "Cardiac problem", ro: "Problemă cardiacă" },
    { en: "Hypoglycemia", ro: "Criză de hipoglicemie" },
    { en: "Fainting", ro: "Stare de leșin" },
    { en: "Dizziness", ro: "Amețeală" },
    { en: "Breathing problems", ro: "Probleme respiratorii" },
  ];
  const sendMedical = (emergency: string) => {
    insert("requests", {
      type: "medical_emergency",
      seat,
      payload: { emergency, conditions: conditions.filter((c) => c !== "none").map((c) => t(c)) },
      status: "new",
      createdAt: Date.now(),
    });
    setConfirmingEmergency(false);
    setOtherEmergency("");
  };

  return (
    <Shell>
      {view === "home" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setConfirmingEmergency((v) => !v)}
            className="flex items-center gap-3 rounded-2xl bg-destructive px-5 py-5 text-left text-lg font-extrabold text-destructive-foreground shadow-sm"
          >
            <AlertTriangle className="h-7 w-7 shrink-0" />
            {t("medicalEmergency")}
          </button>
          {confirmingEmergency && (
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-destructive bg-card p-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                {lang === "ro" ? "Ce se întâmplă?" : "What is happening?"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCIES.map((e) => (
                  <button
                    key={e.en}
                    onClick={() => sendMedical(e[lang])}
                    className="rounded-xl bg-destructive/10 px-3 py-3 text-left text-sm font-bold text-destructive"
                  >
                    {e[lang]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={otherEmergency}
                  onChange={(e) => setOtherEmergency(e.target.value)}
                  placeholder={lang === "ro" ? "Altele..." : "Other..."}
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={() => otherEmergency.trim() && sendMedical(otherEmergency.trim())}
                  className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground"
                >
                  {t("send")}
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() =>
              insert("requests", { type: "call_steward", seat, status: "new", createdAt: Date.now() })
            }
            className="flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-left text-lg font-bold shadow-sm"
          >
            <Bell className="h-7 w-7 shrink-0 text-primary" />
            {t("callSteward")}
          </button>
          <button
            onClick={() => setView("order")}
            className="flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-left text-lg font-bold shadow-sm"
          >
            <ShoppingCart className="h-7 w-7 shrink-0 text-primary" />
            {t("orderSnacks")}
          </button>
          <button
            onClick={() => setView("rate")}
            className="flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-left text-lg font-bold shadow-sm"
          >
            <Star className="h-7 w-7 shrink-0 text-primary" />
            {t("rateFlight")}
          </button>
          <button
            onClick={() => setView("seatmap")}
            className="flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-left text-lg font-bold shadow-sm"
          >
            <MessageSquareWarning className="h-7 w-7 shrink-0 text-primary" />
            {t("complaints")}
          </button>

          {myRequests.length > 0 && (
            <div className="mt-2 rounded-2xl bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold">{t("yourRequests")}</h3>
              <ul className="flex flex-col gap-2">
                {myRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{t(requestTypeLabel(r.type))}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor[r.status]}`}>
                      {t(statusLabel[r.status])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {view === "order" && <OrderMenu seat={seat} onBack={() => setView("home")} />}
      {view === "rate" && <RateView seat={seat} onBack={() => setView("home")} />}
      {view === "seatmap" && (
        <SeatMapView
          ownSeat={seat}
          onBack={() => setView("home")}
          complaintSeat={complaintSeat}
          setComplaintSeat={setComplaintSeat}
        />
      )}
    </Shell>
  );
}

function requestTypeLabel(type: string): TKey {
  switch (type) {
    case "medical_emergency":
      return "medicalEmergency";
    case "call_steward":
      return "callSteward";
    case "order":
      return "orderSnacks";
    default:
      return "complaints";
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-base font-extrabold tracking-tight text-primary">{t("appName")}</span>
        <LangSwitcher />
      </div>
      {children}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-primary">
      <ChevronLeft className="h-4 w-4" /> {t("back")}
    </button>
  );
}

function RateView({ seat, onBack }: { seat: string; onBack: () => void }) {
  const t = useT();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const submit = () => {
    insert("flightRatings", {
      seat,
      turbulence: scores["turbulence"] ?? 3,
      staffBehaviour: scores["staffBehaviour"] ?? 3,
      cleanliness: scores["cleanliness"] ?? 3,
      legroom: scores["legroom"] ?? 3,
      bagSpace: scores["bagSpace"] ?? 3,
      ...(comment ? { comment } : {}),
      createdAt: Date.now(),
    });
    setDone(true);
    setTimeout(onBack, 1500);
  };

  if (done) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-base font-bold text-seat-ok-foreground shadow-sm">
        {t("thanks")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <BackButton onBack={onBack} />
      <h2 className="text-lg font-bold">{t("rateFlight")}</h2>
      {RATING_CATEGORIES.map((cat) => (
        <div key={cat} className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t(cat)}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setScores((s) => ({ ...s, [cat]: n }))}
                aria-label={`${cat} ${n} stars`}
              >
                <Star
                  className={`h-6 w-6 ${
                    (scores[cat] ?? 0) >= n ? "fill-seat-minor text-seat-minor" : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("comment")}
        rows={2}
        className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        onClick={submit}
        className="rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
      >
        {t("submitRating")}
      </button>
    </div>
  );
}

function SeatMapView({
  ownSeat,
  onBack,
  complaintSeat,
  setComplaintSeat,
}: {
  ownSeat: string;
  onBack: () => void;
  complaintSeat: string | null;
  setComplaintSeat: (s: string | null) => void;
}) {
  const t = useT();
  const [category, setCategory] = useState<"noise" | "behaviour" | "other">("noise");
  const [text, setText] = useState("");

  const getStatus = (s: string): SeatStatus => (s === ownSeat ? "own" : "idle");

  const submit = () => {
    if (!complaintSeat) return;
    insert("seatComplaints", {
      fromSeat: ownSeat,
      targetSeat: complaintSeat,
      category,
      text,
      createdAt: Date.now(),
    });
    insert("requests", {
      type: "complaint",
      seat: ownSeat,
      payload: { targetSeat: complaintSeat, category, text },
      status: "new",
      createdAt: Date.now(),
    });
    setComplaintSeat(null);
    setText("");
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <BackButton onBack={onBack} />
      <p className="text-xs font-semibold text-muted-foreground">{t("tapSeatToComplain")}</p>
      <div className="max-h-[55vh] overflow-y-auto rounded-xl bg-secondary/50 p-2">
        <SeatMap
          compact
          getStatus={getStatus}
          onSeatClick={(s) => s !== ownSeat && setComplaintSeat(s)}
          selectedSeat={complaintSeat}
        />
      </div>
      {complaintSeat && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <p className="text-sm font-bold">
            {t("complaintAbout")} {complaintSeat}
          </p>
          <div className="flex gap-2">
            {(["noise", "behaviour", "other"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-1 rounded-full px-2 py-2 text-xs font-bold ${
                  category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t(c)}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("describe")}
            rows={2}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              {t("send")}
            </button>
            <button
              onClick={() => setComplaintSeat(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
