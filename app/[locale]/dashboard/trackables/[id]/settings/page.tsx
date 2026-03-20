import { TrackableSettingsSection } from "../trackable-settings-section"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default function TrackableSettingsPage() {
  return <TrackableSettingsSection />
}
