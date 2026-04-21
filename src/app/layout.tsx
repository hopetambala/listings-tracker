import type { Metadata } from "next";
import DliteProvider from "@/dlite-design-system/DliteProvider";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listings Tracker",
  description: "Track house price listings and market data",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DliteProvider>{children}</DliteProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
