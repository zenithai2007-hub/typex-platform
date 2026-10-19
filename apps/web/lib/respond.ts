import { NextResponse } from 'next/server';

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function err(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function errFrom(e: unknown, code = 'internal_error', status = 500): NextResponse {
  const message = e instanceof Error ? e.message : String(e ?? 'Unknown error');
  return err(code, message, status);
}
