import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utilo",
  description:
    "Compare your Victorian electricity bill live against 135+ current retail plans and see how much you could save.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
