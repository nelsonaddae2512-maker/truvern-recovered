type Review = {
  id: string | number;
  vendorName: string;
  status: string;
  detail?: string;
  href?: string;
};

export default function RecentReviewsCard({ reviews }: { reviews: Review[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
        Recent Reviews
      </p>

      <div className="mt-5 grid gap-3">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <a
              key={review.id}
              href={review.href ?? "#"}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{review.vendorName}</p>
                  {review.detail ? (
                    <p className="mt-1 text-sm text-slate-400">{review.detail}</p>
                  ) : null}
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {review.status}
                </span>
              </div>
            </a>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            No recent reviews yet.
          </p>
        )}
      </div>
    </section>
  );
}
