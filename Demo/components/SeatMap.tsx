export const ROWS = 30;
export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type SeatStatus = "ok" | "minor" | "urgent" | "own" | "idle";

const statusClasses: Record<SeatStatus, string> = {
  ok: "bg-seat-ok text-seat-ok-foreground",
  minor: "bg-seat-minor text-seat-minor-foreground",
  urgent: "bg-seat-urgent text-seat-urgent-foreground animate-pulse-red",
  own: "bg-seat-own text-seat-own-foreground ring-2 ring-seat-own-foreground/40",
  idle: "bg-muted text-muted-foreground",
};

interface SeatMapProps {
  getStatus: (seat: string) => SeatStatus;
  onSeatClick?: (seat: string) => void;
  selectedSeat?: string | null;
  compact?: boolean;
}

/** Cabin plan: rows 1-30, seats A-F with an aisle between C and D. */
export function SeatMap({ getStatus, onSeatClick, selectedSeat, compact }: SeatMapProps) {
  const size = compact ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[10px]";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`mb-1 grid grid-cols-[repeat(3,auto)_1.25rem_repeat(3,auto)] gap-1 ${compact ? "text-[8px]" : "text-[10px]"} font-bold text-muted-foreground`}>
        {LETTERS.slice(0, 3).map((l) => (
          <span key={l} className={`flex ${size} items-center justify-center`}>{l}</span>
        ))}
        <span />
        {LETTERS.slice(3).map((l) => (
          <span key={l} className={`flex ${size} items-center justify-center`}>{l}</span>
        ))}
      </div>
      {Array.from({ length: ROWS }, (_, i) => {
        const row = i + 1;
        return (
          <div key={row} className="grid grid-cols-[repeat(3,auto)_1.25rem_repeat(3,auto)] items-center gap-1">
            {LETTERS.slice(0, 3).map((l) => (
              <Seat key={l} seat={`${row}${l}`} />
            ))}
            <span className={`text-center font-semibold text-muted-foreground ${compact ? "text-[8px]" : "text-[10px]"}`}>{row}</span>
            {LETTERS.slice(3).map((l) => (
              <Seat key={l} seat={`${row}${l}`} />
            ))}
          </div>
        );
      })}
    </div>
  );

  function Seat({ seat }: { seat: string }) {
    const status = getStatus(seat);
    const isSelected = selectedSeat === seat;
    return (
      <button
        type="button"
        aria-label={`Seat ${seat}`}
        onClick={() => onSeatClick?.(seat)}
        className={`flex ${size} items-center justify-center rounded-md font-bold transition-transform ${statusClasses[status]} ${
          onSeatClick ? "cursor-pointer hover:scale-110" : "cursor-default"
        } ${isSelected ? "ring-2 ring-foreground" : ""}`}
      >
        {seat.replace(/^\d+/, "")}
      </button>
    );
  }
}
