import { z } from 'zod'

// Create a draft path. The path is built to reach target_ids (at least one
// goal); title is optional at creation and only required to publish.
export const createLearningPathSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  summary: z.string().trim().max(500).nullish(),
  target_ids: z.array(z.uuid()).min(1),
})

export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>
