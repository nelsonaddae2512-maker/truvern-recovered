import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

describe("RC40L communications first-reply threading contract", () => {
  const sourcePath = path.join(
    process.cwd(),
    "lib",
    "communications",
    "inbound.ts",
  );

  const source = fs.readFileSync(
    sourcePath,
    "utf8",
  );

  it("keeps RFC message correlation ahead of subject fallback", () => {
    const rfcLookup =
      source.indexOf(
        "internetMessageId: { in: threadIds }",
      );

    const subjectFallback =
      source.indexOf(
        "const subject = baseSubject(input.subject);",
      );

    expect(rfcLookup).toBeGreaterThan(-1);
    expect(subjectFallback).toBeGreaterThan(-1);
    expect(rfcLookup).toBeLessThan(subjectFallback);
  });

  it("matches a first reply against a prior TO or CC recipient", () => {
    expect(source).toContain(
      'in: ["TO", "CC"]',
    );

    expect(source).toContain(
      "equals: input.senderAddress",
    );

    expect(source).toMatch(
      /recipients:\s*\{\s*some:\s*\{/,
    );
  });

  it("does not use BCC for first-reply correlation", () => {
    const fallbackStart =
      source.indexOf(
        "const fallback = await findFirstCommunicationConversation",
      );

    const fallbackEnd =
      source.indexOf(
        "if (fallback)",
        fallbackStart,
      );

    expect(fallbackStart).toBeGreaterThan(-1);
    expect(fallbackEnd).toBeGreaterThan(fallbackStart);

    const fallback =
      source.slice(
        fallbackStart,
        fallbackEnd,
      );

    expect(fallback).toContain(
      'in: ["TO", "CC"]',
    );

    expect(fallback).not.toContain(
      '"BCC"',
    );
  });

  it("keeps fallback scoped to organization, mailbox, and normalized subject", () => {
    const fallbackStart =
      source.indexOf(
        "const fallback = await findFirstCommunicationConversation",
      );

    const fallbackEnd =
      source.indexOf(
        "if (fallback)",
        fallbackStart,
      );

    expect(fallbackStart).toBeGreaterThan(-1);
    expect(fallbackEnd).toBeGreaterThan(fallbackStart);

    const fallback =
      source.slice(
        fallbackStart,
        fallbackEnd,
      );

    expect(fallback).toContain(
      "organizationId: input.organizationId",
    );

    expect(fallback).toContain(
      "mailboxId: input.mailboxId",
    );

    expect(fallback).toContain(
      "equals: subject",
    );

    expect(fallback).toContain(
      'mode: "insensitive"',
    );
  });

  it("retains the original inbound-sender match", () => {
    const fallbackStart =
      source.indexOf(
        "const fallback = await findFirstCommunicationConversation",
      );

    const fallbackEnd =
      source.indexOf(
        "if (fallback)",
        fallbackStart,
      );

    const fallback =
      source.slice(
        fallbackStart,
        fallbackEnd,
      );

    expect(fallback).toMatch(
      /fromAddress:\s*\{\s*equals:\s*input\.senderAddress/,
    );
  });
});
