import type { Metadata } from "next";
import "./globals.css";
import "./rts.css";
export const metadata: Metadata = {
  title: "Gridkeeper — Keep the lights on",
  description:
    "Command Sri Lanka’s power grid: manage generation, resources and cascading failures on an interactive tactical map.",
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
