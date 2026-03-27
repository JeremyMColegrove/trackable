export interface WorkspaceCreationSideEffectsInput {
  workspaceId: string
  userId: string
  setActive: boolean
}

export interface WorkspaceCreationSideEffectsDependencies {
  ensureWorkspaceSubscription(workspaceId: string): Promise<unknown>
  clearMembershipsCache(userId: string): Promise<unknown>
  clearActiveWorkspaceCache(userId: string): Promise<unknown>
}

export async function applyWorkspaceCreationSideEffects(
  input: WorkspaceCreationSideEffectsInput,
  dependencies: WorkspaceCreationSideEffectsDependencies
) {
  await dependencies.ensureWorkspaceSubscription(input.workspaceId)
  await dependencies.clearMembershipsCache(input.userId)

  if (input.setActive) {
    await dependencies.clearActiveWorkspaceCache(input.userId)
  }
}
