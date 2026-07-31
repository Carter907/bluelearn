import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { updateProfileSchema } from "@bluelearn/schemas";
import { getServiceSupabase, requireUser } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { CONTRIBUTION, DESTRUCTIVE } from "../middleware/rateLimits";
import type { HonoEnv } from "../types";
import {
  deleteMyAccount,
  getMyActivity,
  getMyDrafts,
  getMyIdentity,
  getMyProfileStats,
  getPublicProfile,
  updateMyProfile,
} from "../services/identity.service";

export const meRouter = new Hono<HonoEnv>()
  // Returns the caller's profile, email, and roles. 404 if no profile row.
  .get("/", requireUser, async (c) => {
    const user = c.get("user");
    const { profile, roles } = await getMyIdentity(c.get("supabase"), user.id);
    return c.json({ profile, email: user.email ?? null, roles });
  })

  // Lists the caller's own draft revisions (guides + objectives), newest first, for
  // a "continue editing" view. Drafts are absent from public listings, so this
  // is the way back in. Keyed on revision id since an unpublished shell has no slug.
  .get("/drafts", requireUser, async (c) => {
    const drafts = await getMyDrafts(c.get("supabase"), c.get("user").id);
    return c.json(drafts);
  })

  // Returns the number of caller's votes received, contributions, and reviews.
  .get("/stats", requireUser, async (c) => {
    const stats = await getMyProfileStats(c.get("supabase"), c.get("user").id);
    return c.json(stats);
  })

  // The caller's activity feed, which includes authored guide and objective
  // revisions and review cases they voted on, sorted by newest first.
  .get("/activity", requireUser, async (c) => {
    const activity = await getMyActivity(c.get("supabase"), c.get("user").id);
    return c.json(activity);
  })

  // Updates the caller's profile. 409 if the username is taken.
  .patch(
    "/",
    requireUser,
    rateLimitMiddleware({ ...CONTRIBUTION, bucket: "profile-update" }),
    zValidator("json", updateProfileSchema),
    async (c) => {
      const user = c.get("user");
      const { profile, roles } = await updateMyProfile(
        c.get("supabase"),
        user.id,
        c.req.valid("json")
      );
      return c.json({ profile, email: user.email ?? null, roles });
    }
  )

  // Permanently deletes the caller's account. Authored work is anonymized rather
  // than removed. The client still holds a session, so it should sign out after.
  .delete(
    "/",
    requireUser,
    rateLimitMiddleware({ ...DESTRUCTIVE, bucket: "account-delete" }),
    async (c) => {
      await deleteMyAccount(getServiceSupabase(c), c.get("user").id);
      return c.body(null, 204);
    }
  );

export const profilesRouter = new Hono<HonoEnv>()
  // Returns a public profile and badges by username. 404 if missing or suspended.
  .get("/:username", async (c) => {
    const { profile, roles } = await getPublicProfile(
      c.get("supabase"),
      getServiceSupabase(c),
      c.req.param("username")
    );
    return c.json({ profile, roles });
  });
