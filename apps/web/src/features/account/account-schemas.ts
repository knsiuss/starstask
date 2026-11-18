import { z } from "zod";

export const deactivateAccountSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirmation: z.literal("DEACTIVATE"),
});

export const deleteAccountSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirmation: z.literal("DELETE"),
  email: z.string().trim().toLowerCase().email(),
});

export const reactivateAccountSchema = z.object({});

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ReactivateAccountInput = z.infer<typeof reactivateAccountSchema>;
