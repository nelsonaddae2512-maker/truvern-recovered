import { NextRequest, NextResponse } from "next/server";

import {
  createDebtReport,
  createEngineeringPlan,
} from "@/lib/atlas/engineering-copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode?: "PLAN" | "REGRESSION" | "DEBT";
      request?: string;
    };

    const mode = body.mode ?? "PLAN";

    if (mode === "DEBT") {
      return NextResponse.json(createDebtReport());
    }

    const userRequest = body.request?.trim();

    if (!userRequest) {
      return NextResponse.json(
        { error: "Describe the feature, patch, or change to analyze." },
        { status: 400 },
      );
    }

    return NextResponse.json(createEngineeringPlan(userRequest, mode));
  } catch (error) {
    console.error("ATLAS Engineering Copilot failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ATLAS Engineering Copilot failed.",
      },
      { status: 500 },
    );
  }
}
