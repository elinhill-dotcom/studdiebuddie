import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "studdiebuddie_admin";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "Studdiebuddieadmin";
}

export function createAdminToken() {
  return createHmac("sha256", getAdminPassword())
    .update("studdiebuddie-admin-v1")
    .digest("hex");
}

export function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;
  const expected = createAdminToken();
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const jar = await cookies();
  return verifyAdminToken(jar.get(ADMIN_COOKIE)?.value);
}

export function assertAdminPassword(password: string) {
  const expected = getAdminPassword();
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
