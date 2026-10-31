import { createFileRoute } from "@tanstack/react-router";
import { SplitDemo } from "@/components/SplitDemo";

export const Route = createFileRoute("/p")({
  head: () => ({
    meta: [
      { title: "Sky4All — Passenger & crew demo" },
      {
        name: "description",
        content:
          "Sky4All passenger view: join your flight, pick your seat, call a steward, report a medical emergency, order snacks and rate the flight.",
      },
      { property: "og:title", content: "Sky4All — Passenger & crew demo" },
      {
        property: "og:description",
        content: "Sky4All passenger view: alerts, orders, complaints and flight ratings in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SplitDemo,
});

