import crypto from "crypto";

export function safeStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeChecksum(value: unknown): string | null {
  const checksum = safeStr(value).toLowerCase();
  return checksum || null;
}

export function shortChecksum(value: unknown, size = 12): string {
  const checksum = normalizeChecksum(value);
  return checksum ? `${checksum.slice(0, size)}...` : "Unavailable";
}

export function checksumJson(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

