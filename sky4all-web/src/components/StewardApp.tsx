import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, UploadCloud } from "lucide-react";
import {
  update,
  insert,
  useCollection,
  type Request,
  type RequestStatus,
} from "@/lib/ditto";
import { useT, LangSwitcher, type TKey } from "@/lib/i18n";
import { SeatMap, type SeatStatus } from "@/components/SeatMap";

type Tab = "urgent" | "calls" | "orders" | "complaints";

function avgRating(r: {
  turbulence: number;
  staffBehaviour: number;
  cleanliness: number;
  legroom: number;
  bagSpace: number;
}) {
  return (r.turbulence + r.staffBehaviour + r.cleanliness + r.legroom + r.bagSpace) / 5;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // audio unavailable — visual alert still shows
  }
}

export function StewardApp() {
  const t = useT();
  const requests = useCollection("requests");
  const orders = useCollection("orders");
  const complaints = useCollection("seatComplaints");
  const ratings = useCollection("flightRatings");
  const passengers = useCollection("passengers");

  const [tab, setTab] = useState<Tab>("urgent");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

  const open = useMemo(() => requests.filter((r) => r.status !== "resolved"), [requests]);
  const urgent = open.filter((r) => r.type === "medical_emergency" || r.type === "call_steward");
  const calls = open.filter((r) => r.type === "call_steward");
  const openOrders = orders.filter((o) => o.status !== "resolved");

  // Sound alert when a new urgent item arrives
  const prevUrgent = useRef(urgent.length);
  useEffect(() => {
    if (urgent.length > prevUrgent.current) beep();
    prevUrgent.current = urgent.length;
  }, [urgent.length]);

  const getStatus = (seat: string): SeatStatus => {
    const seatOpen = open.filter((r) => r.seat === seat);
    if (seatOpen.some((r) => r.type === "medical_emergency" || r.type === "call_steward"))
      return "urgent";
    const poor = ratings.some((r) => r.seat === seat && avgRating(r) <= 2);
    if (poor) return "urgent";
    if (seatOpen.length > 0 || complaints.some((c) => c.targetSeat === seat)) return "minor";
    return "ok";
  };

  const advance = (col: "requests" | "orders", id: string, status: RequestStatus) => {
    const next: Record<RequestStatus, RequestStatus | null> = {
      new: "seen",
      seen: "in_progress",
      in_progress: "resolved",
      resolved: null,
    };
    const n = next[status];
    if (n) update(col, id, { status: n });
  };

  const tabs: { id: Tab; label: TKey; count: number; alert?: boolean }[] = [
    { id: "urgent", label: "urgent", count: urgent.length, alert: urgent.length > 0 },
    { id: "calls", label: "calls", count: calls.length },
    { id: "orders", label: "orders", count: openOrders.length },
    { id: "complaints", label: "complaints", count: complaints.length },
  ];

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-base font-extrabold tracking-tight text-primary">
          <Plane className="h-5 w-5" /> {t("appName")} · {t("steward")}
        </span>
        <LangSwitcher />
      </div>

      {/* Tab-style notifications */}
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`relative rounded-xl px-2 py-2.5 text-xs font-bold shadow-sm transition-colors ${
              tab === tb.id ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            } ${tb.alert ? "animate-pulse-red" : ""}`}
          >
            {t(tb.label)}
            <span
              className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${
                tb.alert
                  ? "bg-seat-urgent text-seat-urgent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {tb.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[auto_1fr]">
        {/* Heatmap */}
        <div className="overflow-y-auto rounded-2xl bg-card p-3 shadow-sm">
          <SeatMap compact getStatus={getStatus} onSeatClick={setSelectedSeat} selectedSeat={selectedSeat} />
        </div>

        {/* Right column: tab list + seat panel */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-card p-3 shadow-sm">
            {tab === "urgent" && (
              <RequestList
                items={urgent}
                empty={t("emptyTab")}
                render={(r) => <RequestRow key={r.id} r={r} onAdvance={() => advance("requests", r.id, r.status)} />}
              />
            )}
            {tab === "calls" && (
              <RequestList
                items={calls}
                empty={t("emptyTab")}
                render={(r) => <RequestRow key={r.id} r={r} onAdvance={() => advance("requests", r.id, r.status)} />}
              />
            )}
            {tab === "orders" && (
              <ul className="flex flex-col gap-2">
                {openOrders.length === 0 && <li className="text-sm text-muted-foreground">{t("emptyTab")}</li>}
                {openOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
                    <div>
                      <span className="font-bold">{o.seat}</span>
                      <span className="ml-2 text-muted-foreground">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                      </span>
                    </div>
                    <StatusButton status={o.status} onClick={() => advance("orders", o.id, o.status)} />
                  </li>
                ))}
              </ul>
            )}
            {tab === "complaints" && (
              <ul className="flex flex-col gap-2">
                {complaints.length === 0 && <li className="text-sm text-muted-foreground">{t("emptyTab")}</li>}
                {complaints.map((c) => (
                  <li key={c.id} className="rounded-xl bg-secondary px-3 py-2 text-sm">
                    <span className="font-bold">{c.fromSeat} → {c.targetSeat}</span>
                    <span className="ml-2 rounded-full bg-seat-minor px-2 py-0.5 text-[10px] font-bold text-seat-minor-foreground">
                      {t(c.category)}
                    </span>
                    {c.text && <p className="mt-1 text-xs text-muted-foreground">{c.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedSeat && (
            <SeatPanel
              seat={selectedSeat}
              onClose={() => setSelectedSeat(null)}
              requests={requests.filter((r) => r.seat === selectedSeat)}
              complaints={complaints.filter((c) => c.targetSeat === selectedSeat)}
              ratings={ratings.filter((r) => r.seat === selectedSeat)}
              passenger={passengers.find((p) => p.seat === selectedSeat)}
              onAdvance={(id, status) => advance("requests", id, status)}
            />
          )}

          <EndFlightButton />
        </div>
      </div>
    </div>
  );
}

function RequestList({
  items,
  empty,
  render,
}: {
  items: Request[];
  empty: string;
  render: (r: Request) => React.ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="flex flex-col gap-2">{items.map(render)}</ul>;
}

function RequestRow({ r, onAdvance }: { r: Request; onAdvance: () => void }) {
  const t = useT();
  const label: TKey =
    r.type === "medical_emergency"
      ? "medicalEmergency"
      : r.type === "call_steward"
        ? "callSteward"
        : r.type === "order"
          ? "orderSnacks"
          : "complaints";
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
        r.type === "medical_emergency" ? "bg-seat-urgent/15" : "bg-secondary"
      }`}
    >
      <div>
        <span className="font-bold">{r.seat}</span>
        <span className="ml-2 font-semibold">{t(label)}</span>
        {r.type === "medical_emergency" && Array.isArray(r.payload?.["conditions"]) && (r.payload["conditions"] as string[]).length > 0 && (
          <p className="text-xs font-semibold text-seat-urgent">
            {(r.payload["conditions"] as string[]).join(", ")}
          </p>
        )}
      </div>
      <StatusButton status={r.status} onClick={onAdvance} />
    </li>
  );
}

function StatusButton({ status, onClick }: { status: RequestStatus; onClick: () => void }) {
  const t = useT();
  const labels: Record<RequestStatus, TKey> = {
    new: "markSeen",
    seen: "startProgress",
    in_progress: "resolve",
    resolved: "resolved",
  };
  if (status === "resolved") {
    return (
      <span className="rounded-full bg-seat-ok px-2.5 py-1 text-[11px] font-bold text-seat-ok-foreground">
        {t("resolved")}
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
    >
      {t(labels[status])}
    </button>
  );
}

function SeatPanel({
  seat,
  onClose,
  requests,
  complaints,
  ratings,
  passenger,
  onAdvance,
}: {
  seat: string;
  onClose: () => void;
  requests: Request[];
  complaints: { id: string; fromSeat: string; category: "noise" | "behaviour" | "other"; text: string }[];
  ratings: { id: string; turbulence: number; staffBehaviour: number; cleanliness: number; legroom: number; bagSpace: number; comment?: string }[];
  passenger?: { name: string; medicalConditions: string[] } | undefined;
  onAdvance: (id: string, status: RequestStatus) => void;
}) {
  const t = useT();
  const passengerRatings = useCollection("passengerRatings").filter((r) => r.seat === seat);
  const [score, setScore] = useState(3);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold">
          {t("requestsFor")} {seat}
          {passenger && <span className="ml-2 text-sm font-semibold text-muted-foreground">{passenger.name}</span>}
        </h3>
        <button onClick={onClose} className="text-sm font-bold text-primary">✕</button>
      </div>

      {passenger && passenger.medicalConditions.length > 0 && (
        <p className="rounded-xl bg-seat-urgent/15 px-3 py-2 text-xs font-bold text-seat-urgent">
          {t("medicalLabel")}: {passenger.medicalConditions.join(", ")}
        </p>
      )}

      {requests.length > 0 && (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <RequestRow key={r.id} r={r} onAdvance={() => onAdvance(r.id, r.status)} />
          ))}
        </ul>
      )}

      {complaints.map((c) => (
        <p key={c.id} className="rounded-xl bg-secondary px-3 py-2 text-xs">
          <span className="font-bold">{t(c.category)}</span> · {c.fromSeat}: {c.text}
        </p>
      ))}

      {ratings.length > 0 && (
        <div className="text-xs">
          <p className="mb-1 font-bold">{t("ratingHistory")}</p>
          {ratings.map((r) => (
            <p key={r.id} className="text-muted-foreground">
              ★ {avgRating(r).toFixed(1)} {t("avg")} {r.comment ? `— “${r.comment}”` : ""}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-xs font-bold">{t("ratePassenger")}</p>
        <div className="flex items-center gap-2">
          <select
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            aria-label={t("score")}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("note")}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              insert("passengerRatings", { seat, score, note, createdAt: Date.now() });
              setNote("");
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            {t("send")}
          </button>
        </div>
        {passengerRatings.map((r) => (
          <p key={r.id} className="text-xs text-muted-foreground">
            ★ {r.score} — {r.note}
          </p>
        ))}
      </div>
    </div>
  );
}

function EndFlightButton() {
  const t = useT();
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (progress === null || progress >= 100) return;
    const id = setTimeout(() => setProgress((p) => Math.min(100, (p ?? 0) + 8)), 120);
    return () => clearTimeout(id);
  }, [progress]);

  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      {progress === null ? (
        <button
          onClick={() => setProgress(0)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        >
          <UploadCloud className="h-4 w-4" /> {t("endFlight")}
        </button>
      ) : progress < 100 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("uploading")}</p>
          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-seat-ok px-4 py-3 text-center text-sm font-bold text-seat-ok-foreground">
          {t("uploadComplete")}
        </p>
      )}
    </div>
  );
}
