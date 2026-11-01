import { Link } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { PassengerApp } from "@/components/PassengerApp";
import { StewardApp } from "@/components/StewardApp";
import { useDittoStatus } from "@/lib/ditto";
import { useLang, useT } from "@/lib/i18n";

const statusLabel = {
  demo: { ro: "Ditto activ", en: "Ditto active" },
  connecting: { ro: "Se conectează la Ditto…", en: "Connecting to Ditto…" },
  live: { ro: "Ditto live", en: "Ditto live" },
  error: { ro: "Ditto local", en: "Ditto local" },
} as const;

export function SplitDemo() {
  const t = useT();
  const ro = useLang() === "ro";
  const status = useDittoStatus();
  return (
    <div className="flex h-screen min-h-[640px] flex-col gap-4 p-2 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">
          <Plane className="h-6 w-6" /> {t("appName")}
        </h1>
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span
            className={`inline-block size-2 rounded-full ${
              status === "live"
                ? "bg-seat-ok"
                : status === "connecting"
                  ? "bg-seat-minor"
                  : status === "error"
                    ? "bg-seat-urgent"
                    : "bg-seat-ok"
            }`}
          />
          {t("liveDemo")} · {statusLabel[status][ro ? "ro" : "en"]}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-4">
        <section className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {t("passenger")}
            </h2>
            <Link to="/p" target="_blank" className="text-xs font-bold text-primary underline">
              {t("openPassenger")}
            </Link>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-[420px] flex-1 rounded-[2rem] border-4 border-foreground/80 bg-background shadow-xl sm:border-8">
            <div className="h-full overflow-y-auto rounded-[1.6rem]">
              <PassengerApp />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {t("steward")}
            </h2>
            <Link to="/s" target="_blank" className="text-xs font-bold text-primary underline">
              {t("openSteward")}
            </Link>
          </div>
          <div className="min-h-0 flex-1 rounded-[1.5rem] border-4 border-foreground/80 bg-background shadow-xl sm:border-8">
            <div className="h-full overflow-y-auto rounded-[1.1rem]">
              <StewardApp />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
