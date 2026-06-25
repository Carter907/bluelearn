import { Hono } from 'hono'
import { requireUser } from '../middleware/auth.middleware'
import type { HonoEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { createLearningPathSchema } from '@bluelearn/schemas'
import {
  archiveLearningPath,
  createLearningPath,
  getLearningPathBySlug,
  listLearningPathRevisions,
  listPublishedLearningPaths,
} from '../services/learning-path.service'

export const learningPathsRouter = new Hono<HonoEnv>()
  // Returns published paths as { learning_paths }.
  .get('/', async (c) => {
    const learning_paths = await listPublishedLearningPaths(c.get('supabase'))
    return c.json({ learning_paths })
  })

  // 201 with { revision_id } for the editor route.
  .post('/', requireUser, zValidator('json', createLearningPathSchema), async (c) => {
    const { revision_id } = await createLearningPath(c.get('supabase'), c.req.valid('json'))
    return c.json({ revision_id }, 201)
  })

  // Returns the path and its live revision's snapshot as { path, snapshot }.
  .get('/:slug', async (c) => {
    const { path, snapshot } = await getLearningPathBySlug(c.get('supabase'), c.req.param('slug'))
    return c.json({ path, snapshot })
  })

  // Archives the path. 404 if missing or not permitted.
  .delete('/:slug', requireUser, async (c) => {
    const path = await archiveLearningPath(c.get('supabase'), c.req.param('slug'))
    return c.json({ path })
  })

  // Returns the revision history as { revisions }, newest first.
  .get('/:slug/revisions', async (c) => {
    const revisions = await listLearningPathRevisions(c.get('supabase'), c.req.param('slug'))
    return c.json({ revisions })
  })

  // 201 with { revision_id } for the new draft.
  .post('/:slug/revisions', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

export const learningPathRevisionsRouter = new Hono<HonoEnv>()
  // Gets the full snapshot of one revision: metadata, nodes, projected edges, and raw edges.
  .get('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

  // Overwrite a draft revision's metadata (draft only)
  .patch('/:id', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Add a target: flag a base as a goal and pull its prerequisite closure into
  // the node set. Returns the recomputed snapshot.
  .post('/:id/targets', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Remove a target: clear the flag and remove topics kept only to reach it.
  // Returns the recomputed snapshot.
  .delete('/:id/targets/:baseId', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Edit a node: swap the chosen variant, set a note, toggle is_target, or
  // skip/re-include it. Skipping is a soft hide, not a delete.
  .patch('/:id/nodes/:baseId', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Publish the draft directly: freeze its edges and point the path at it
  .post('/:id/publish', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Roll back: clone an older revision's targets/nodes into a new draft
  .post('/:id/rollback', requireUser, (c) => c.json({ error: 'Not implemented' }, 501))

  // Rendered diff between two revision snapshots
  .get('/:id/diff/:otherId', (c) => c.json({ error: 'Not implemented' }, 501))
