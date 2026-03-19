import { TrackableLayoutClient } from "./trackable-shell"

export const dynamic = "force-static"

export function generateStaticParams() {
  return []
}

export default async function TrackableLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params

  return (
    <TrackableLayoutClient trackableId={resolvedParams.id}>
      {children}
    </TrackableLayoutClient>
  )
}
