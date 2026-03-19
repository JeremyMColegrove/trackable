import { TrackableApiKeysSection } from "../trackable-sections"

export const dynamic = "force-static"

export function generateStaticParams() {
  return []
}

export default function TrackableApiKeysPage() {
  return <TrackableApiKeysSection />
}
