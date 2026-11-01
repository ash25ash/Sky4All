import { createFileRoute } from "@tanstack/react-router";
import { SplitDemo } from "@/components/SplitDemo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sky4All — Live demo: passenger & steward" },
      {
        name: "description",
        content:
          "Split-screen Sky4All demo: a passenger phone and a steward tablet synced live through a mock Ditto store. Send alerts, orders, complaints and reviews.",
      },
      { property: "og:title", content: "Sky4All — Live demo: passenger & steward" },
      {
        property: "og:description",
        content:
          "Split-screen Sky4All demo: a passenger phone and a steward tablet synced live through a mock Ditto store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SplitDemo,
});

