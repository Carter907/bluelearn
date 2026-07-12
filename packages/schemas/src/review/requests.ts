import { z } from "zod";
import { decisionReasonSchema } from "./enums";

// An approve carries optional notes, whereas a reject must carry notes plus
// at least one rubric reason.
export const createDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approved"),
    notes: z.string().trim().nullish(),
  }),
  z.object({
    decision: z.literal("rejected"),
    notes: z.string().trim().min(1),
    reasons: z.array(decisionReasonSchema).min(1),
  }),
]);

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
