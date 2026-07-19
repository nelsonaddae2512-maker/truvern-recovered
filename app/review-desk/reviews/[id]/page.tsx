import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function LegacyReviewWorkspaceRedirect({ params }: Props) {
  const resolved = await params;
  const id = String(resolved.id || "").trim();

  redirect(`/review-desk/${id}`);
}
