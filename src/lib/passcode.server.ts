import { createHash } from "node:crypto";

export function hashPasscode(passcode: string) {
  return createHash("sha256").update(passcode.trim(), "utf8").digest("hex");
}

export function slugifyName(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "member";
}

export function synthEmail(name: string) {
  return `${slugifyName(name)}-${Math.random().toString(36).slice(2, 8)}@studyhub.local`;
}
