import { pageMeta } from "@/lib/seo";
import SiteHeader from "../components/SiteHeader";
import styles from "../components/Comparator.module.css";
import GasCheck from "./GasCheck";
import SiteFooter from "../components/SiteFooter";

export const metadata = pageMeta({ title: "Victorian gas plan check", description: "Snap your gas bill and see which Victorian gas plans would cost less for your home. Free, no sign-up.", path: "/gas" });

export default function GasPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <GasCheck />
        <SiteFooter />
      </div>
    </>
  );
}
