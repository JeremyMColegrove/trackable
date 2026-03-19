import { TrackableFormSection } from "../trackable-sections"

export const dynamic = "force-static"

export function generateStaticParams() {
  return []
}

export default function TrackableFormPage() {
  return <TrackableFormSection />
}
