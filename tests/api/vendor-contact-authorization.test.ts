import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const repoRoot = process.cwd();

const itemRoute = fs.readFileSync(
  path.join(
    repoRoot,
    "app",
    "api",
    "vendors",
    "[id]",
    "contacts",
    "[contactId]",
    "route.ts",
  ),
  "utf8",
);

const collectionRoute = fs.readFileSync(
  path.join(
    repoRoot,
    "app",
    "api",
    "vendors",
    "[id]",
    "contacts",
    "route.ts",
  ),
  "utf8",
);

describe(
  "vendor contact authorization boundary",
  () => {
    it(
      "derives tenant authority from authenticated DB organization",
      () => {
        for (const source of [
          itemRoute,
          collectionRoute,
        ]) {
          expect(source).toContain(
            'const { userId } = await auth();',
          );

          expect(source).toContain(
            "const org = await requireDbOrganization();",
          );

          expect(source).toContain(
            "organizationId: org.id",
          );
        }
      },
    );

    it(
      "tenant-scopes item contact mutations through the requested vendor",
      () => {
        expect(itemRoute).toContain(
          "async function readScopedVendor(",
        );

        expect(itemRoute).toContain(
          "id: vendorId,",
        );

        expect(itemRoute).toContain(
          "organizationId,",
        );

        expect(itemRoute).toContain(
          "await readScopedVendor(",
        );

        expect(itemRoute).toContain(
          "gate.organizationId",
        );

        expect(itemRoute).toContain(
          "id: contactId,",
        );

        expect(itemRoute).toContain(
          "vendorId: vendor.id",
        );
      },
    );

    it(
      "tenant-scopes collection contact creation before mutation",
      () => {
        const postStart =
          collectionRoute.indexOf(
            "export async function POST",
          );

        expect(postStart).toBeGreaterThanOrEqual(0);

        const post =
          collectionRoute.slice(postStart);

        const authIndex =
          post.indexOf(
            "requireApiAuth()",
          );

        const vendorIndex =
          post.indexOf(
            "const vendor = await findFirstVendor({",
          );

        const organizationIndex =
          post.indexOf(
            "organizationId: gate.organizationId,",
          );

        const transactionIndex =
          post.indexOf(
            "prisma.$transaction",
          );

        expect(authIndex).toBeGreaterThanOrEqual(0);
        expect(vendorIndex).toBeGreaterThan(authIndex);
        expect(organizationIndex).toBeGreaterThan(
          vendorIndex,
        );
        expect(transactionIndex).toBeGreaterThan(
          organizationIndex,
        );

        expect(post).toContain(
          "vendorId: vendor.id",
        );
      },
    );

    it(
      "keeps vendor contact routes free of unsafe raw SQL",
      () => {
        for (const source of [
          itemRoute,
          collectionRoute,
        ]) {
          expect(source).not.toContain(
            "$queryRawUnsafe",
          );

          expect(source).not.toContain(
            "$executeRawUnsafe",
          );
        }
      },
    );
  },
);