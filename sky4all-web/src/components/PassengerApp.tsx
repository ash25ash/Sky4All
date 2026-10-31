import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ShoppingCart,
  Star,
  Armchair,
} from "lucide-react";
import { insert, useCollection, type RequestStatus } from "@/lib/ditto";
import { useT, LangSwitcher, type TKey } from "@/lib/i18n";
import { SeatMap, type SeatStatus } from "@/components/SeatMap";
import { OrderMenu } from "@/components/OrderMenu";

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

  // Onboarding state (kept in memory, per demo spec)
  const [flightId, setFlightId] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");
  const [seat, setSeat] = useState<string | null>(null);
  const [row, setRow] = useState(14);
  const [letter, setLetter] = useState("C");
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<TKey[]>([]);
  const [profileDone, setProfileDone] = useState(false);

  const [view, setView] = useState<View>("home");
  const [confirmingEmergency, setConfirmingEmergency] = useState(false);
  const [complaintSeat, setComplaintSeat] = useState<string | null>(null);

  const requests = useCollection("requests");
  const myRequests = useMemo(
    () => (seat ? requests.filter((r) => r.seat === seat).sort((a, b) => b.createdAt - a.createdAt) : []),
    [requests, seat],
  );

  // --- Step 1: flight detection -------------------------------------------
  if (!flightId) {
    return (
      <Shell>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm">
          <div className="rounded-xl bg-accent p-4 text-center">
            <p className="text-sm font-semibold text-accent-foreground">{t("flightDetected")}</p>
            <button
              onClick={() => setFlightId("RO361")}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
            >
              {t("join")} RO361
            </button>
          </div>
          {showCodeInput ? (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t("flightCodePlaceholder")}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => code.trim() && setFlightId(code.trim())}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                {t("continue")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCodeInput(true)}
              className="text-sm font-semibold text-primary underline"
            >
              {t("enterManually")}
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // --- Step 2: seat selection ---------------------------------------------
  if (!seat) {
    return (
      <Shell>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">{t("selectSeat")}</h2>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {t("row")}
              <select
                value={row}
                onChange={(e) => setRow(Number(e.target.value))}
                className="rounded-xl border border-input bg-background px-3 py-3"
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {t("letter")}
              <select
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-3"
              >
                {["A", "B", "C", "D", "E", "F"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => {
              setRow(14);
              setLetter("C");
            }}
            className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
          >
            {t("useBoardingPass")} (14C)
          </button>
          <button
            onClick={() => setSeat(`${row}${letter}`)}
            className="rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
          >
            {t("continue")} · {row}{letter}
          </button>
        </div>
      </Shell>
    );
  }

  // --- Step 3: optional profile -------------------------------------------
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
      insert("passengers", {
        name: name || "Anonymous",
        seat,
        flightId,
        medicalConditions: conditions.filter((c) => c !== "none").map((c) => t(c)),
      });
      setProfileDone(true);
    };
    return (
      <Shell>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">{t("yourProfile")}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("name")}
            className="rounded-xl border border-input bg-background px-3 py-3 text-sm"
          />
          <p className="text-sm font-semibold">{t("medicalConditions")}</p>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  conditions.includes(c)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t(c)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={finish}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
            >
              {t("save")}
            </button>
            <button
              onClick={() => setProfileDone(true)}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold"
            >
              {t("skip")}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // --- Main app ------------------------------------------------------------
  const sendMedical = () => {
    if (!confirmingEmergency) {
      setConfirmingEmergency(true);
      setTimeout(() => setConfirmingEmergency(false), 4000);
      return;
    }
    insert("requests", {
      type: "medical_emergency",
      seat,
      payload: { conditions: conditions.filter((c) => c !== "none").map((c) => t(c)) },
      status: "new",
      createdAt: Date.now(),
    });
    setConfirmingEmergency(false);
  };

  return (
    <Shell>
      {view === "home" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={sendMedical}
            className={`flex items-center gap-3 rounded-2xl px-5 py-5 text-left text-lg font-extrabold shadow-sm transition-colors ${
              confirmingEmergency
                ? "bg-seat-urgent text-seat-urgent-foreground animate-pulse-red"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            <AlertTriangle className="h-7 w-7 shrink-0" />
            {confirmingEmergency ? t("confirmEmergency") : t("medicalEmergency")}
          </button>
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
            <Armchair className="h-7 w-7 shrink-0 text-primary" />
            {t("seatMap")}
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
