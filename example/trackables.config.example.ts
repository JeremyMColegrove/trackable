/**
 * use this to define your config.json file and map to container volume
 *
 * ... volumes:
 *        ./your_config.json:/config.json
 *
 *  */

type Config = {
  // array of site admin emails, they have access to things like batch process pages
  admins: string[]
  features: {
    // if upgrading or viewing plans other than free are enabled. If false, it would show billing coming soon
    subscriptionEnforcementEnabled: boolean
    // if it should show billing or tiers at all on the page/sidebars
    workspaceBillingEnabled: boolean
    // if batch process scheduler should be enabled
    batchSchedulerEnabled: boolean
    // use the standard oauth/clerk api token to access mcp server
    // if custom, use self managed api tokens
    customMCPServerTokens: boolean
  }
  // define limits for the system. To tie a limit to a billing tier, pass the billing tier id into billingTier field
  limits: {
    // id for this limit
    id: "string"
    // max trackables a user can have per workspace
    maxTrackableItems: number
    // max number of responses a user can have per survey
    maxResponsesPerSurvey: number | null
    // max number of members a workspace can have
    maxWorkspaceMembers: number | null
    // max number of logs per minute per trackable
    maxApiLogsPerMinute: number
    // max log payload size
    maxApiPayloadBytes: number
    // max retention days for all logs
    logRetentionDays: number
    // max number of workspaces per user
    maxCreatedWorkspaces: number | null
    // option billing tier id (applies to all users if null)
    billingTier: "string"
  }[]
  // optional billing info
  billing: {
    // your lemon squeezy store id
    lemonSqueezyStoreId: string | null
    // your billing url, usually something.<your-domain>/billing
    manageUrl: string | null
    // array of billing tiers
    tiers: {
      // unique tier id
      id: "string"
      // unique name
      name: string
      // price amount to display (e.g. $25)
      priceLabel: string
      // price interval (e.g. monthly)
      priceInterval: string
      // description of tier
      description: string
      // unique theme of this tier
      tone: "neutral" | "accent" | "strong"
      // if true, shows most popular badge
      mostPopular: boolean
      // this tiers lemon squeezy product variant id
      lemonSqueezyVariantId: string | null
      // if this tier is enabled
      enabled: boolean
    }[]
  }
  usage: {
    // how many bad api key bounces allowed per minute
    invalidApiKeyRateLimitPerMinute: number
    // max number of bytes in log body
    maxBodyBytes: number
    // number of logs per page to load at once
    pageSize: number
  }
  // webhook info
  webhooks: {
    // enable webhook queue in redis
    queue: {
      enabled: boolean
      // how long to wait before sending next webhook
      rateLimitMs: number
      rateLimitMax: number
    }
  }
  batch: {
    schedulerTimeZone: string
  }
}
