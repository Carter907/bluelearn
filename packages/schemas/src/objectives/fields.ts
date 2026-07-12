import { z } from "zod";

// User-facing content primitives, shared across the objective/revision/node
// requests so a trim or length rule lives in one place.
export const objectiveTitleSchema = z.string().trim().min(1).max(200);
export const objectiveSummarySchema = z.string().trim().max(500);
export const objectiveChangeSummarySchema = z.string().trim().max(500);
