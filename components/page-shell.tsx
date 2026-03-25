export function PageShell({
  title,
  description,
  headerActions,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  headerActions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
        {children}
      </div>
    </main>
  )
}
