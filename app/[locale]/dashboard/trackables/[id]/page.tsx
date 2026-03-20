import { TrackableOverviewSection } from "./trackable-overview-section"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default function TrackablePage() {
  return <TrackableOverviewSection />
}
