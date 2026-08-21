import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteNotifications } from "@/lib/repositories/notification-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = Number(params.id);

  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  await deleteNotifications({
    where: {
      id,
      userId,
    },
  });

  return NextResponse.json({ ok: true });
}

