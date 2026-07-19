export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, userId };
}

export async function GET(_req: Request) {
  
  const g = await requireUserId();
  if (!g.ok) return g.res;
return NextResponse.json({ ok: true, route: '/app/api/trust/[slug]' });
}





