import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyRedirectPage() {
  redirect("/truvern-reviews");
}
