import { z } from "zod";
import {
  guideBodySchema,
  guideChangeSummarySchema,
  guideSlugSchema,
  guideSummarySchema,
  guideTitleSchema,
  guideTodoTitleSchema,
} from "./fields";
import { subjectNameSchema } from "../subjects";
import {
  downvoteReasonSchema,
  knowledgeTypeSchema,
  voteDirectionSchema,
} from "./enums";

// The editable content of a revision.
const revisionContentSchema = z.object({
  title: guideTitleSchema,
  summary: guideSummarySchema.nullish(),
  body: guideBodySchema.nullish(),
});

export const newSubjectSchema = z.object({
  name: subjectNameSchema,
  summary: guideSummarySchema.nullish(),
});

export const createGuideSchema = z.object({
  knowledge_type: knowledgeTypeSchema.default("theoretical"),
  title: guideTitleSchema.nullish(),
  summary: guideSummarySchema.nullish(),
  body: guideBodySchema.nullish(),
  tags: z.array(z.uuid()).default([]),
  prerequisites: z.array(guideSlugSchema).default([]),
  newSubjects: z.array(newSubjectSchema).default([]),
  todoPrereqs: z.array(guideTodoTitleSchema).default([]),
});

// A variant starts as a draft like a guide does, so every field here is optional
// and completeness is checked at submit. Its own slug is assigned at publish.
export const createVariantSchema = revisionContentSchema.extend({
  title: guideTitleSchema.nullish(),
  tags: z.array(z.uuid()).default([]),
  newSubjects: z.array(newSubjectSchema).default([]),
});

// Edits to a draft revision before it goes for review. Send only the fields you
// want to change (at least one is required).
export const updateRevisionSchema = revisionContentSchema
  .extend({
    title: guideTitleSchema.nullish(),
    change_summary: guideChangeSummarySchema.nullish(),
    tags: z.array(z.uuid()),
    prerequisites: z.array(guideSlugSchema),
    newSubjects: z.array(newSubjectSchema),
    todoPrereqs: z.array(guideTodoTitleSchema),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  });

// reason is required if the direction is down.
export const castVoteSchema = z
  .object({
    direction: voteDirectionSchema,
    reason: downvoteReasonSchema.nullish(),
    note: z.string().trim().nullish(),
  })
  .refine((v) => (v.direction === "down") === (v.reason != null), {
    message: "reason is required on a downvote and forbidden otherwise",
    path: ["reason"],
  });

export const rollbackRevisionSchema = z.object({
  revision_id: z.uuid(),
});

export type CreateGuideInput = z.infer<typeof createGuideSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type RollbackRevisionInput = z.infer<typeof rollbackRevisionSchema>;
