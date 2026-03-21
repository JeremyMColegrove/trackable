import { createHmac, timingSafeEqual } from "node:crypto"

export function verifyLemonSqueezyWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex")

  if (digest.length !== signatureHeader.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader))
}
