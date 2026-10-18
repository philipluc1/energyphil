import type { Metadata } from "next";
import "./globals.css";
import LeaveSiteGuard from "./components/LeaveSiteGuard";
import { SourceCapture } from "./components/SourceBanner";

export const metadata: Metadata = {
  title: "Utilo",
  description:
    "Small, medium or large? Your home is none of them. Utilo reads your Victorian electricity bill and prices current plans for your home, not a typical household.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        <LeaveSiteGuard />
        <SourceCapture />
      </body>
    </html>
  );
}
