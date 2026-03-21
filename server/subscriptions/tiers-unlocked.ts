import "server-only"

export function areTiersUnlocked(): boolean {
  return process.env.NEXT_PUBLIC_TIERS_UNLOCKED === "true"
}
