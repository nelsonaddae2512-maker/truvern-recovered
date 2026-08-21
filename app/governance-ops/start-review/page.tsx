import { redirect } from "next/navigation";
import { findOrCreateInternalReviewAssignment } from "@/lib/repositories/internal-review-start-repository";

type Props = {
  searchParams?: Promise<{
    assessmentId?: string;
    vendorId?: string;
  }>;
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export default async function StartReviewPage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};

  const assessmentId = safeInt(resolved.assessmentId);
  const vendorId = safeInt(resolved.vendorId);

  if (!assessmentId || !vendorId) {
    redirect("/review-desk");
  }

  const rows = await findOrCreateInternalReviewAssignment({
    vendorId,
    assessmentId,
  });

  const assignmentId = rows[0]?.assignmentId;

  if (!assignmentId) {
    redirect("/review-desk");
  }

  redirect(`/review-desk/reviews/${assignmentId}`);
}



