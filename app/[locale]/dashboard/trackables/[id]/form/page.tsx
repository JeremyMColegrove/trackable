import { TrackableFormSection } from "../trackable-form-section"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default function TrackableFormPage() {
  return <TrackableFormSection />
}
