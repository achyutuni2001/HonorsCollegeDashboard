import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Honors College Analytics",
  description: "Executive analytics dashboard for Honors College rosters"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
