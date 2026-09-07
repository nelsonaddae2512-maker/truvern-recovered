import GovernancePacketPage from "@/app/review-desk/reviews/[id]/packet/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params:
    | Promise<{ id: string }>
    | { id: string };
};

export default async function CustomerCisoReportPage(
  props: Props,
) {
  return GovernancePacketPage(props);
}
