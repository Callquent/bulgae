import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: message, ...extra }, { status });
export const notFound = (message = "Ressource introuvable.") => error(message, 404);

export async function readJson(req: Request): Promise<Record<string, any> | null> {
  try {
    const data = await req.json();
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
}

export function isForeignKeyError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2003";
}
