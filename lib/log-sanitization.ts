import { createHash } from "node:crypto"

export function fingerprintValue(value: string, length: number = 12) {
  return createHash("sha256").update(value).digest("hex").slice(0, length)
}
