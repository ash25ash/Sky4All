import { createFileRoute } from "@tanstack/react-router";
import { StewardApp } from "@/components/StewardApp";

export const Route = createFileRoute("/s")({
  head: () => ({
    meta: [
      { title: "Sky4All — Steward tablet" },
      {
        name: "description",
        content:
          "Sky4All steward view: live cabin heatmap, urgent alerts, calls, orders and complaints with a seat-level detail panel.",
      },
      { property: "og:title", content: "Sky4All — Steward tablet" },
      {
        property: "og:description",
        content: "Sky4All steward view: live cabin heatmap and real-time passenger requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StewardPage,
});

function StewardPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-3 p-2">
      <StewardApp />
    </div>
  );
}
