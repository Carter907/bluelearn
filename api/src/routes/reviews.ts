import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDecisionSchema, paginationSchema } from "@bluelearn/schemas";
import {
  getAuthenticatedUser,
  getServiceSupabase,
  requireUser,
} from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { MODERATION } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  castDecision,
  getReviewCase,
  getReviewQueue,
  listReviewCases,
} from "../services/review.service";
import {
  scheduleSearchSync,
  syncGuideForReviewCase,
} from "../services/search.service";

export const reviewsRouter = new Hono<HonoEnv>()
  // Open cases needing action from the current reviewer
  .get(
    "/queue",
    requireUser,
    zValidator("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await getReviewQueue(
        c.get("supabase"),
        c.get("user").id,
        { page, limit }
      );
      return c.json({ cases: data, total }, 200);
    }
  )

  // All finished review cases (public — only returns approved/rejected)
  .get("/cases", async (c) => {
    const cases = await listReviewCases(c.get("supabase"));
    return c.json({ cases }, 200);
  })

  // Case detail with panel, members, decisions, and linked revision (public).
  // The proposed prerequisites, todos, and subjects come along once the case
  // closes or beforehand for the author and the seated panel.
  .get("/cases/:id", async (c) => {
    const { user } = await getAuthenticatedUser(c);
    const result = await getReviewCase(
      c.get("supabase"),
      getServiceSupabase(c),
      c.req.param("id"),
      user?.id ?? null
    );
    return c.json(result, 200);
  })

  // Cast a panel vote with written justification
  .post(
    "/cases/:id/decisions",
    requireUser,
    rateLimitMiddleware({ ...MODERATION, bucket: "review-decision" }),
    zValidator("json", createDecisionSchema),
    async (c) => {
      const input = c.req.valid("json");
      const result = await castDecision(
        c.get("supabase"),
        c.req.param("id"),
        input
      );
      // This vote may have published the revision — refresh the search index
      // for the guide behind this case (best-effort).
      scheduleSearchSync(
        c,
        syncGuideForReviewCase(c.env, c.get("supabase"), c.req.param("id"))
      );
      return c.json({ decision: result }, 200);
    }
  );
