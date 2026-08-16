import { NextRequest, NextResponse } from "next/server";
import { applyMutation, getState, type Mutation } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { mutations?: Mutation[] };
  const list = Array.isArray(body.mutations) ? body.mutations : [];
  for (const m of list) applyMutation(m);
  return NextResponse.json({ ok: true, state: getState() });
}
