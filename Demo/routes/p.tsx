import { createFileRoute } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { PassengerApp } from "@/components/PassengerApp";
import { useDittoStatus } from "@/lib/ditto";
import { useLang, useT } from "@/lib/i18n";

const statusLabel = {
  demo: { ro: "Ditto activ", en: "Ditto active" },
  connecting: { ro: "Se conectează la Ditto…", en: "Connecting to Ditto…" },
  live: { ro: "Ditto live", en: "Ditto live" },
  error: { ro: "Ditto local", en: "Ditto local" },
} as const;

export const Route = createFileRoute("/p")({
  head: () => ({
    meta: [
      { title: "Sky4All — Passenger view" },
      {
        name: "description",
        content:
          "Sky4All passenger view: join your flight, pick your seat, call a steward, report a medical emergency, order snacks and rate the flight.",
      },
      { property: "og:title", content: "Sky4All — Passenger view" },
      {
        property: "og:description",
        content: "Sky4All passenger view: alerts, orders, complaints and flight ratings in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassengerPage,
});

function PassengerPage() {
  const t = useT();
  const ro = useLang() === "ro";
  const status = useDittoStatus();

  return (
    <div className="flex h-screen min-h-[640px] flex-col gap-3 p-2 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">
          <Plane className="h-6 w-6" /> {t("appName")} · {t("passenger")}
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

      <div className="mx-auto min-h-0 w-full max-w-[420px] flex-1 rounded-[2rem] border-4 border-foreground/80 bg-background shadow-xl sm:border-8">
        <div className="h-full overflow-y-auto rounded-[1.6rem]">
          <PassengerApp />
        </div>
      </div>
    </div>
  );
}
