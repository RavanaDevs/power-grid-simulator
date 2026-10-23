import type { Metadata } from "next";
import "./globals.css";
import "./rts.css";
import "leaflet/dist/leaflet.css";
import "./simulator.css";
import "./simulator-dark.css";
export const metadata: Metadata = {
  title: "Lanka Grid — Sri Lanka Power System Simulator",
  description:
    "Explore Sri Lankan power infrastructure on OpenStreetMap and operate a transparent educational grid simulation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
