import { GET as getReviewDeskPacketPdf } from "@/app/review-desk/reviews/[id]/packet/pdf/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params:
    | Promise<{ id: string }>
    | { id: string };
};

export async function GET(
  request: Request,
  props: Props,
) {
  return getReviewDeskPacketPdf(
    request,
    props,
  );
}
