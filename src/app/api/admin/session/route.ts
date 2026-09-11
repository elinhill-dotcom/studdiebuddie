import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  assertAdminPassword,
  createAdminToken,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;
  if (!body?.password || !assertAdminPassword(body.password)) {
    return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const { isAdminAuthenticated } = await import("@/lib/admin-auth");
  const ok = await isAdminAuthenticated();
  return NextResponse.json({ ok });
}
