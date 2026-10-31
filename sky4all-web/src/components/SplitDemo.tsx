import { Link } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { PassengerApp } from "@/components/PassengerApp";
import { StewardApp } from "@/components/StewardApp";
import { SimulatePanel } from "@/components/SimulatePanel";
import { useT } from "@/lib/i18n";

export function SplitDemo() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col gap-4 overflow-x-auto p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">
          <Plane className="h-6 w-6" /> {t("appName")}
        </h1>
        <p className="text-xs font-semibold text-muted-foreground">{t("liveDemo")}</p>
      </header>

      <SimulatePanel />

      <div className="grid min-w-[760px] flex-1 grid-cols-[minmax(320px,420px)_minmax(400px,1fr)] gap-4">
        {/* Passenger phone mockup */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {t("passenger")}
            </h2>
            
          </div>
          <div className="mx-auto w-full max-w-[420px] rounded-[2rem] border-8 border-foreground/80 bg-background shadow-xl">
            <div className="h-[70vh] min-h-[480px] overflow-y-auto rounded-[1.6rem]">
              <PassengerApp />
            </div>
          </div>
        </section>

        {/* Steward tablet mockup */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {t("steward")}
            </h2>
            <Link to="/s" className="text-xs font-bold text-primary underline">
              {t("openSteward")}
            </Link>
          </div>
          <div className="rounded-[1.5rem] border-8 border-foreground/80 bg-background shadow-xl">
            <div className="h-[70vh] min-h-[480px] overflow-y-auto rounded-[1.1rem]">
              <StewardApp />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
