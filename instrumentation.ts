export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const { bootstrapBatchScheduler } = await import("@/server/batch/bootstrap")

  await bootstrapBatchScheduler()
}
