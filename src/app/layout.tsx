import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gökbörü Cafe",
    template: "%s | Gökbörü Cafe",
  },
  description: "Gökbörü Cafe web ve işletme yönetim sistemi.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
