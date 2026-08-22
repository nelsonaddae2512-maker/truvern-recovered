import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

describe("RC40L communications count synchronization", () => {
  const sourcePath = path.join(
    process.cwd(),
    "components",
    "communications",
    "communications-center.client.tsx",
  );

  const source = fs.readFileSync(
    sourcePath,
    "utf8",
  );

  it("refreshes detail and conversation summaries together", () => {
    const threadStart =
      source.indexOf("<ConversationThread");

    expect(threadStart).toBeGreaterThan(-1);

    const threadEnd =
      source.indexOf(
        "/>",
        threadStart,
      );

    expect(threadEnd).toBeGreaterThan(threadStart);

    const invocation =
      source.slice(
        threadStart,
        threadEnd,
      );

    expect(invocation).toContain(
      "onRefresh={() => {",
    );

    expect(invocation).toContain(
      "Promise.all([",
    );

    expect(invocation).toContain(
      "loadConversationDetail(",
    );

    expect(invocation).toContain(
      "loadConversations({",
    );

    expect(invocation).toContain(
      "quiet: true",
    );
  });

  it("conversation cards still use aggregate message counts", () => {
    expect(source).toContain(
      "{conversation.counts.messages} messages",
    );
  });

  it("detail still uses the returned message timeline", () => {
    expect(source).toContain(
      "Array.isArray(body.messages)",
    );

    expect(source).toContain(
      "? body.messages",
    );
  });
});
