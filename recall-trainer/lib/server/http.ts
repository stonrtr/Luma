import "server-only";
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json(data as object, { status: init ?? 200 });
}

export function bad(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : "Внутренняя ошибка";
  return NextResponse.json({ error: message }, { status: 500 });
}
