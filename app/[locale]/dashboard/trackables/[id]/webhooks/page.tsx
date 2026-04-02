import { WebhooksPageClient } from "./webhooks-page-client"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default function TrackableWebhooksPage() {
  return <WebhooksPageClient />
}
