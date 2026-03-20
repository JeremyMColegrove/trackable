import { TrackableApiKeysSection } from "../trackable-api-keys-section"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default function TrackableApiKeysPage() {
  return <TrackableApiKeysSection />
}
