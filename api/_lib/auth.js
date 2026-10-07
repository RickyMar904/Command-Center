import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s) => createHash("sha256").update(String(s)).digest();

/** Compares the passcode sent by the app with SYNC_PASSCODE without leaking timing. */
export function passcodeOk(given, expected) {
  if (!expected || typeof given !== "string" || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}
