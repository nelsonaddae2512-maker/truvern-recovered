import prisma from "@/lib/prisma";

export type TrustNetworkVendorRow = {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  updatedAt: Date;
  releaseCount: number;
  latestReleaseAt: Date | null;
};

export type TrustNetworkManifestRow = {
  id: number;
  checksum: string | null;
  createdAt: Date;
  status: string;
};

export async function readTrustNetworkVendorBySlug(
  slug: string,
): Promise<TrustNetworkVendorRow[]> {
  return prisma.$queryRaw<TrustNetworkVendorRow[]>`
    select
      v.id,
      v.name,
      v.slug,
      v.category,
      v."updatedAt",
      count(distinct gm.id)::int as "releaseCount",
      max(gm."createdAt") as "latestReleaseAt"
    from "Vendor" v
    left join "ReviewRequest" rr
      on rr."vendorId" = v.id
    left join "ReviewAssignment" ra
      on ra."reviewRequestId" = rr.id
    left join "GovernanceReleaseManifest" gm
      on gm."reviewAssignmentId" = ra.id
    where lower(v.slug) = lower(${slug})
    group by v.id
    limit 1
  `;
}

export async function readTrustNetworkVendorManifests(
  vendorId: number,
): Promise<TrustNetworkManifestRow[]> {
  return prisma.$queryRaw<TrustNetworkManifestRow[]>`
    select
      gm.id,
      gm.checksum,
      gm."createdAt",
      ra.status::text as status
    from "GovernanceReleaseManifest" gm
    join "ReviewAssignment" ra
      on ra.id = gm."reviewAssignmentId"
    join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"
    join "Vendor" v
      on v.id = rr."vendorId"
    where v.id = ${vendorId}
    order by gm."createdAt" desc
    limit 10
  `;
}