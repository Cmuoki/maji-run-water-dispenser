import { createFileRoute } from "@tanstack/react-router";
import { MajiRunApp } from "../components/MajiRunApp";

export const Route = createFileRoute("/")({
  component: MajiRunApp,
  head: () => ({
    meta: [
      { title: "Maji Run — Fresh Water Dispenser" },
      { name: "description", content: "Purchase fresh, clean water from Maji Run dispensers. Pay easily with M-Pesa." },
      { property: "og:title", content: "Maji Run — Fresh Water Dispenser" },
      { property: "og:description", content: "Purchase fresh, clean water from Maji Run dispensers." },
    ],
  }),
});
