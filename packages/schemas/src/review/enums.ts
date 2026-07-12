import { z } from "zod";

export const decisionReasonSchema = z.enum([
  "hierarchy_issue",
  "factual_error",
  "duplicate_content",
  "scope_violation",
  "clarity_issue",
  "missing_required_information",
]);

export type DecisionReason = z.infer<typeof decisionReasonSchema>;
