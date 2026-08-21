import { NextRequest, NextResponse } from "next/server";
import {
  getExecutionState,
  rollbackExecution,
  syncExecutionState,
  transitionExecution,
  validateExecution,
} from "@/lib/atlas/execution-orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getExecutionState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ATLAS execution state failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: string;
      patchId?: string;
      target?: string;
      actor?: string;
      note?: string;
      checkpointReference?: string;
    };

    if (body.action === "sync") return NextResponse.json(syncExecutionState());

    if (!body.patchId) {
      return NextResponse.json({ error: "patchId is required." }, { status: 400 });
    }

    if (body.action === "transition") {
      if (!body.target) {
        return NextResponse.json({ error: "target is required." }, { status: 400 });
      }
      return NextResponse.json(
        transitionExecution(
          body.patchId,
          body.target,
          body.actor,
          body.note,
          body.checkpointReference,
        ),
      );
    }

    if (body.action === "validate") {
      return NextResponse.json(validateExecution(body.patchId, body.actor));
    }

    if (body.action === "rollback") {
      return NextResponse.json(rollbackExecution(body.patchId, body.actor, body.note));
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ATLAS execution action failed." },
      { status: 500 },
    );
  }
}
