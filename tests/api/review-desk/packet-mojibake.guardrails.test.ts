import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packetTargets = [
  "app/review-desk/reviews/[id]/packet/page.tsx",
  "app/review-desk/reviews/[id]/packet/pdf/route.ts",
  "app/governance-ops/reviews/[id]/packet/page.tsx",
  "app/governance-ops/reviews/[id]/packet/pdf/route.ts",
];

const suspiciousCodePoints = [
  0x00c2,
  0x00c3,
  0x00e2,
  0x20ac,
  0x2122,
  0xfffd,
];

describe("packet mojibake guardrails", () => {
  it.each(packetTargets)(
    "%s contains no known mojibake marker code points",
    (relativePath) => {
      const source = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        "utf8",
      );

      for (const codePoint of suspiciousCodePoints) {
        expect(
          source.includes(String.fromCodePoint(codePoint)),
          `unexpected U+${codePoint
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")} in ${relativePath}`,
        ).toBe(false);
      }
    },
  );

  it("keeps the intended bullet character in active packet rendering", () => {
    const bullet = String.fromCodePoint(0x2022);

    const reviewPacket = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/review-desk/reviews/[id]/packet/page.tsx",
      ),
      "utf8",
    );

    const opsPacket = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/governance-ops/reviews/[id]/packet/page.tsx",
      ),
      "utf8",
    );

    expect(reviewPacket).toContain(bullet);
    expect(opsPacket).toContain(bullet);
  });
});