import { pageMeta } from "@/lib/seo";
import Comparator from "../components/Comparator";

export const metadata = pageMeta({ title: "Free electricity bill check for Victorian homes", description: "Upload a photo or PDF of your power bill, or answer a few questions, and see what each retailer's plan would cost you. About a minute, and free.", path: "/check" });

export default function CheckPage() {
  return <Comparator />;
}
