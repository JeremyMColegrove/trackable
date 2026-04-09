import { z } from "zod"

export const updateProfileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    image: z.string().trim().url().nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.image !== undefined, {
    message: "At least one profile field must be provided.",
  })

export const changeEmailInputSchema = z.object({
  newEmail: z.email(),
  callbackURL: z.string().trim().min(1).optional(),
})

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  revokeOtherSessions: z.boolean().optional(),
})

export const setPasswordInputSchema = z.object({
  newPassword: z.string().min(1),
})

export const revokeSessionInputSchema = z.object({
  token: z.string().min(1),
})
