import { NextRequest, NextResponse } from "next/server";

import { answerAtlasQuestion } from "@/lib/atlas/architecture-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { question?: unknown };
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "A non-empty architecture question is required." },
        { status: 400 },
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Architecture questions are limited to 1,000 characters." },
        { status: 400 },
      );
    }

    return NextResponse.json(answerAtlasQuestion(question));
  } catch (error) {
    console.error("ATLAS architecture assistant failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ATLAS architecture assistant failed.",
      },
      { status: 500 },
    );
  }
}
