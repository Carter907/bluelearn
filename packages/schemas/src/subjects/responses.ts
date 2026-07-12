import { z } from "zod";

// A subject as listed/browsed. guides_total and objectives_total are aggregates
// the API derives from guide_subjects and objective_subjects count.
export const subjectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  guides_total: z.number().int(),
  objectives_total: z.number().int(),
});

export type Subject = z.infer<typeof subjectSchema>;
