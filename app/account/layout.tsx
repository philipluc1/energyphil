import type { Metadata } from "next";
import type { ReactNode } from "react";

// Members' and sign-up pages: never in search results.
export const metadata: Metadata = {
  title: "My dashboard",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
