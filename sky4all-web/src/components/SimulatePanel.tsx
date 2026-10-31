import { insert, resetAll } from "@/lib/ditto";
import { useT, type TKey } from "@/lib/i18n";

const randomSeat = () =>
  `${1 + Math.floor(Math.random() * 30)}${"ABCDEF"[Math.floor(Math.random() * 6)]}`;

export function SimulatePanel() {
  const t = useT();

  const actions: { label: TKey; run: () => void; danger?: boolean }[] = [
    {
      label: "simMedical",
      danger: true,
      run: () =>
        insert("requests", {
          type: "medical_emergency",
          seat: randomSeat(),
          payload: { conditions: ["asthma"] },
          status: "new",
          createdAt: Date.now(),
        }),
    },
    {
      label: "simCall",
      run: () =>
        insert("requests", { type: "call_steward", seat: randomSeat(), status: "new", createdAt: Date.now() }),
    },
    {
      label: "simOrder",
      run: () => {
        const seat = randomSeat();
        const items = [
          { name: "Coffee", qty: 1 },
          { name: "Chips", qty: 1 },
        ];
        insert("orders", { seat, items, status: "new", createdAt: Date.now() });
        insert("requests", { type: "order", seat, payload: { items }, status: "new", createdAt: Date.now() });
      },
    },
    {
      label: "simComplaint",
      run: () =>
        insert("seatComplaints", {
          fromSeat: randomSeat(),
          targetSeat: randomSeat(),
          category: "noise",
          text: "Simulated complaint",
          createdAt: Date.now(),
        }),
    },
    {
      label: "simBadReview",
      danger: true,
      run: () =>
        insert("flightRatings", {
          seat: randomSeat(),
          turbulence: 1,
          staffBehaviour: 1,
          cleanliness: 2,
          legroom: 1,
          bagSpace: 1,
          comment: "Simulated very bad review",
          createdAt: Date.now(),
        }),
    },
    { label: "reset", run: () => resetAll() },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-card p-3 shadow-sm">
      <span className="mr-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {t("simulate")}
      </span>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.run}
          className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
            a.danger
              ? "bg-seat-urgent text-seat-urgent-foreground"
              : a.label === "reset"
                ? "border border-border bg-background text-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          {t(a.label)}
        </button>
      ))}
    </div>
  );
}
