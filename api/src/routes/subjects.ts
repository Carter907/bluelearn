import { Hono } from "hono";
import { paginationSchema } from "@bluelearn/schemas";
import { zValidator } from "@hono/zod-validator";
import type { HonoEnv } from "../types";
import {
  getSubjectBySlug,
  listSubjectGuides,
  listSubjectObjectives,
  listSubjects,
} from "../services/subject.service";

export const subjectsRouter = new Hono<HonoEnv>()
  // List all subjects
  .get("/", zValidator("query", paginationSchema), async (c) => {
    const { page, limit } = c.req.valid("query");
    const { data, total } = await listSubjects(c.get("supabase"), {
      page,
      limit,
    });
    return c.json({ subjects: data, total }, 200);
  })

  // Subject metadata only
  .get("/:slug", async (c) => {
    const subject = await getSubjectBySlug(
      c.get("supabase"),
      c.req.param("slug")
    );
    return c.json({ subject }, 200);
  })

  // Alphabetical list of guides carrying this subject tag
  .get("/:slug/guides", zValidator("query", paginationSchema), async (c) => {
    const { page, limit } = c.req.valid("query");
    const { data, total } = await listSubjectGuides(
      c.get("supabase"),
      c.req.param("slug"),
      { page, limit }
    );
    return c.json({ guides: data, total }, 200);
  })

  // Alphabetical list of published objectives tagged with this subject
  .get(
    "/:slug/objectives",
    zValidator("query", paginationSchema),
    async (c) => {
      const { page, limit } = c.req.valid("query");
      const { data, total } = await listSubjectObjectives(
        c.get("supabase"),
        c.req.param("slug"),
        { page, limit }
      );
      return c.json({ objectives: data, total }, 200);
    }
  );
