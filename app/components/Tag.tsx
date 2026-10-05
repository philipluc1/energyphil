import type { ReactNode } from "react";
import ui from "./ui.module.css";

export type TagTone = "amber" | "green" | "teal" | "navy" | "glass";

export default function Tag({ tone = "navy", shine = false, dot = false, children }: { tone?: TagTone; shine?: boolean; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`${ui.tag} ${ui[tone]} ${shine ? ui.shine : ""}`}>
      {dot && <span className={ui.dot} />}
      {children}
    </span>
  );
}
