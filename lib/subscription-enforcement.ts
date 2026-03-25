export function isSubscriptionEnforcementEnabledValue(
  value: string | undefined
): boolean {
  return value === "true"
}

export function isSubscriptionEnforcementEnabled(): boolean {
  return isSubscriptionEnforcementEnabledValue(
    process.env.ENABLE_SUBSCRIPTIONS
  )
}
