import { describe, it, expect } from "vitest";
import app from "../src/index";
import { admin, env, jsonAuth, makeUser, type Insert } from "./helpers";
import { assemblePendingPanels } from "../src/services/review.service";
import {
  createReviewCase,
  createReviewPanel,
  createPanelMember,
  createGuideReviewCase,
  createVerifier,
  suspendAllVerifiers,
  seedPendingReviewCase,
  seedSeatedReviewCase,
} from "./factories/reviews";
import {
  createGuideBase,
  createGuide,
  createGuideRevision,
  createPublishedGuide,
} from "./factories/guides";
import { createSubject, tagGuideRevision } from "./factories/subjects";
import { createPrerequisite, createTodo } from "./factories/graph";
import { expectToMatchSpec } from "./openapi";

async function seedQueueCase(
  userId: string,
  title: string,
  status: Insert<"review_cases">["status"] = "pending",
  seatCount = 1
) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id);
  const revision = await createGuideRevision(guide.id, { title });
  const reviewCase = await createReviewCase(userId, {
    case_type: "guide_publish",
    status,
  });
  const panel = await createReviewPanel(reviewCase.id, {
    target_seat_count: seatCount,
  });
  await createPanelMember(panel.id, userId);
  for (let i = 1; i < seatCount; i++) {
    const { userId: filler } = await makeUser();
    await createPanelMember(panel.id, filler);
  }
  await createGuideReviewCase(reviewCase.id, revision.id);
  return reviewCase;
}

type SubmissionBody = {
  revision: { tags: Array<{ id: string; status: string }> } | null;
  prerequisites: Array<{ slug: string; title: string | null }>;
  todos: Array<{ id: string; title: string }>;
  viewer_role: string;
};

// A first-time contribution: draft base and guide, one published tag, one
// subject proposed inline, one prerequisite, one todo.
async function seedSubmissionCase(
  panelistId: string,
  status: Insert<"review_cases">["status"] = "pending",
  authorId?: string
) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id);
  const revision = await createGuideRevision(guide.id, {
    title: "Topology",
    author_id: authorId,
  });

  const published = await createSubject();
  const proposed = await createSubject({ slug: null, status: "draft" });
  await tagGuideRevision(revision.id, published.id);
  await tagGuideRevision(revision.id, proposed.id);

  const prereq = await createPublishedGuide({ title: "Set Theory" });
  await createPrerequisite(prereq.base.id, base.id);
  const todo = await createTodo(base.id, { title: "Metric Spaces" });

  const reviewCase = await createReviewCase(panelistId, {
    case_type: "guide_publish",
    status,
  });
  const panel = await createReviewPanel(reviewCase.id, {
    target_seat_count: 1,
  });
  await createPanelMember(panel.id, panelistId);
  await createGuideReviewCase(reviewCase.id, revision.id);

  return {
    reviewCase,
    published: published.id,
    proposed: proposed.id,
    prereqSlug: prereq.base.slug!,
    todoTitle: todo.title,
  };
}

describe("GET /reviews/queue", () => {
  it("401s without a token", async () => {
    const res = await app.request("/reviews/queue", {}, env);
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "GET", "/reviews/queue");
  });

  it("returns a case where the caller is an assigned panelist", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Calculus");

    const res = await app.request(
      "/reviews/queue",
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/queue");
    const body = (await res.json()) as {
      cases: Array<{ id: string; title: string }>;
    };
    const mine = body.cases.find((c) => c.id === reviewCase.id);
    expect(mine?.title).toBe("Calculus");
  });

  it("omits cases where the caller has no seat", async () => {
    const { userId } = await makeUser();
    const { token } = await makeUser(); // different caller, no seat
    const reviewCase = await seedQueueCase(userId, "Calculus");

    const res = await app.request(
      "/reviews/queue",
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/queue");
    const body = (await res.json()) as { cases: Array<{ id: string }> };
    expect(body.cases.map((c) => c.id)).not.toContain(reviewCase.id);
  });
});

describe("GET /reviews/cases", () => {
  it("lists review cases", async () => {
    const { userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics", "approved");

    const res = await app.request("/reviews/cases", {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases");
    const body = (await res.json()) as { cases: Array<{ id: string }> };
    expect(body.cases.map((c) => c.id)).toContain(reviewCase.id);
  });
});

describe("GET /reviews/cases/{id}", () => {
  it("returns a case with its panel and decisions", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics");

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
    const body = (await res.json()) as {
      case: { id: string };
      viewer_role: string;
    };
    expect(body.case.id).toBe(reviewCase.id);
    expect(body.viewer_role).toBe("panelist");
  });

  it("403s an outsider while the case is open", async () => {
    const { userId: panelist } = await makeUser();
    const { reviewCase } = await seedSubmissionCase(panelist);

    const res = await app.request(`/reviews/cases/${reviewCase.id}`, {}, env);

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
  });

  it("shows an open case to the revision author", async () => {
    const { token, userId: author } = await makeUser();
    const { userId: panelist } = await makeUser();
    const { reviewCase, prereqSlug, todoTitle } = await seedSubmissionCase(
      panelist,
      "pending",
      author
    );

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
    const body = (await res.json()) as SubmissionBody;
    expect(body.viewer_role).toBe("author");
    expect(body.prerequisites.map((p) => p.slug)).toEqual([prereqSlug]);
    expect(body.todos.map((t) => t.title)).toEqual([todoTitle]);
  });

  it("shows the proposed graph to a seated panelist", async () => {
    const { token, userId: panelist } = await makeUser();
    const { reviewCase, proposed, prereqSlug, todoTitle } =
      await seedSubmissionCase(panelist);

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
    const body = (await res.json()) as SubmissionBody;
    expect(body.prerequisites.map((p) => p.slug)).toEqual([prereqSlug]);
    expect(body.todos.map((t) => t.title)).toEqual([todoTitle]);
    expect(body.revision?.tags.map((t) => t.id)).toContain(proposed);
  });

  it("shows the proposed graph to everyone once the case closes", async () => {
    const { userId: panelist } = await makeUser();
    const { reviewCase, proposed, prereqSlug, todoTitle } =
      await seedSubmissionCase(panelist, "approved");

    const res = await app.request(`/reviews/cases/${reviewCase.id}`, {}, env);

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
    const body = (await res.json()) as SubmissionBody;
    expect(body.prerequisites.map((p) => p.slug)).toEqual([prereqSlug]);
    expect(body.todos.map((t) => t.title)).toEqual([todoTitle]);
    expect(body.revision?.tags.map((t) => t.id)).toContain(proposed);
  });
});

describe("POST /reviews/cases/{id}/decisions", () => {
  it("401s without a token", async () => {
    const res = await app.request(
      `/reviews/cases/${crypto.randomUUID()}/decisions`,
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "POST", "/reviews/cases/{id}/decisions");
  });

  it("records an approving decision for an assigned panelist", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics");

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", {
        decision: "approved",
        notes: "Clear and accurate.",
      }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/reviews/cases/{id}/decisions");
  });

  it("records a rejecting decision with its rubric reasons", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics");

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", {
        decision: "rejected",
        notes: "Missing prerequisites.",
        reasons: ["missing_required_information", "clarity_issue"],
      }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "POST", "/reviews/cases/{id}/decisions");
    const body = (await res.json()) as { decision: { reasons: string[] } };
    expect(body.decision.reasons).toEqual([
      "missing_required_information",
      "clarity_issue",
    ]);
  });

  it("400s a reject with no rubric reasons", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics");

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", {
        decision: "rejected",
        notes: "Missing prerequisites.",
        reasons: [],
      }),
      env
    );

    expect(res.status).toBe(400);
  });

  it("drops the case from the caller's queue once decided", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(userId, "Statistics");

    await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", { decision: "approved" }),
      env
    );

    const res = await app.request(
      "/reviews/queue",
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );
    const body = (await res.json()) as { cases: Array<{ id: string }> };
    expect(body.cases.map((c) => c.id)).not.toContain(reviewCase.id);
  });

  it("lets a panelist re-vote, revising their decision and reasons", async () => {
    const { token, userId } = await makeUser();
    const reviewCase = await seedQueueCase(
      userId,
      "Statistics",
      "in_review",
      3
    );

    await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", {
        decision: "rejected",
        notes: "Missing prerequisites.",
        reasons: ["clarity_issue"],
      }),
      env
    );

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(token, "POST", { decision: "approved", notes: "Fixed." }),
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      decision: { decision: string; reasons: string[] };
    };
    expect(body.decision.decision).toBe("approved");
    expect(body.decision.reasons).toEqual([]);
  });
});

async function panelsFor(caseId: string) {
  const { data } = await admin
    .from("review_panels")
    .select("id, target_seat_count, outcome, closed_at")
    .eq("case_id", caseId);
  return data ?? [];
}

async function caseStatus(caseId: string) {
  const { data } = await admin
    .from("review_cases")
    .select("status")
    .eq("id", caseId)
    .single();
  return data?.status;
}

async function castApprove(token: string, caseId: string) {
  return app.request(
    `/reviews/cases/${caseId}/decisions`,
    jsonAuth(token, "POST", { decision: "approved" }),
    env
  );
}

describe("assemblePendingPanels", () => {
  it("seats an odd panel and moves the case to in_review", async () => {
    const author = await makeUser();
    await createVerifier();
    await createVerifier();
    await createVerifier();
    const { reviewCase } = await seedPendingReviewCase(author.userId);

    await assemblePendingPanels(admin);

    const panels = await panelsFor(reviewCase.id);
    expect(panels).toHaveLength(1);
    expect(panels[0].target_seat_count % 2).toBe(1);
    expect(await caseStatus(reviewCase.id)).toBe("in_review");

    const { data: seats } = await admin
      .from("panel_members")
      .select("id")
      .eq("panel_id", panels[0].id);
    expect(seats).toHaveLength(panels[0].target_seat_count);
  });

  it("leaves the case pending when the verifier pool is too small", async () => {
    await suspendAllVerifiers();
    const author = await makeUser();
    await createVerifier(); // one eligible verifier, below the minimum panel
    const { reviewCase } = await seedPendingReviewCase(author.userId);

    await assemblePendingPanels(admin);

    expect(await panelsFor(reviewCase.id)).toHaveLength(0);
    expect(await caseStatus(reviewCase.id)).toBe("pending");
  });

  it("excludes the case author from their own panel", async () => {
    const author = await createVerifier();
    await createVerifier();
    await createVerifier();
    const { reviewCase } = await seedPendingReviewCase(author.userId);

    await assemblePendingPanels(admin);

    const panels = await panelsFor(reviewCase.id);
    const { data: seats } = await admin
      .from("panel_members")
      .select("member_id")
      .eq("panel_id", panels[0].id);
    expect(seats?.map((s) => s.member_id)).not.toContain(author.userId);
  });

  it("is idempotent across repeated runs", async () => {
    const author = await makeUser();
    await createVerifier();
    await createVerifier();
    await createVerifier();
    const { reviewCase } = await seedPendingReviewCase(author.userId);

    await assemblePendingPanels(admin);
    await assemblePendingPanels(admin);

    expect(await panelsFor(reviewCase.id)).toHaveLength(1);
  });
});

describe("close_review_panel via cast decision", () => {
  it("publishes a first guide on an approving majority", async () => {
    const base = await createGuideBase();
    const guide = await createGuide(base.id);
    const revision = await createGuideRevision(guide.id, {
      title: "Ring Theory",
    });
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_publish",
      seats: 3,
      revisionId: revision.id,
    });

    await castApprove(panelists[0].token, reviewCase.id);
    await castApprove(panelists[1].token, reviewCase.id);

    expect(await caseStatus(reviewCase.id)).toBe("approved");

    const { data: rev } = await admin
      .from("guide_revisions")
      .select("approved_at")
      .eq("id", revision.id)
      .single();
    expect(rev?.approved_at).not.toBeNull();

    const { data: g } = await admin
      .from("guides")
      .select("status, current_revision_id, slug")
      .eq("id", guide.id)
      .single();
    expect(g?.status).toBe("published");
    expect(g?.current_revision_id).toBe(revision.id);
    expect(g?.slug).toBe("ring-theory");

    const { data: b } = await admin
      .from("guide_bases")
      .select("status, canonical_guide_id")
      .eq("id", base.id)
      .single();
    expect(b?.status).toBe("published");
    expect(b?.canonical_guide_id).toBe(guide.id);
  });

  it("assigns a slug to the subjects the approved revision proposed", async () => {
    const base = await createGuideBase();
    const guide = await createGuide(base.id);
    const revision = await createGuideRevision(guide.id, { title: "Topology" });
    const subject = await createSubject({
      slug: null,
      name: "Point Set Topology",
      status: "draft",
    });
    await tagGuideRevision(revision.id, subject.id);

    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_publish",
      seats: 3,
      revisionId: revision.id,
    });

    await castApprove(panelists[0].token, reviewCase.id);
    await castApprove(panelists[1].token, reviewCase.id);

    const { data: s } = await admin
      .from("subjects")
      .select("slug, status")
      .eq("id", subject.id)
      .single();
    expect(s?.status).toBe("published");
    expect(s?.slug).toBe("point-set-topology");
  });

  it("suffixes a proposed subject slug that is already taken", async () => {
    await createSubject({ slug: "graph-theory" });
    const base = await createGuideBase();
    const guide = await createGuide(base.id);
    const revision = await createGuideRevision(guide.id, { title: "Graphs" });
    const subject = await createSubject({
      slug: null,
      name: "Graph Theory",
      status: "draft",
    });
    await tagGuideRevision(revision.id, subject.id);

    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_publish",
      seats: 3,
      revisionId: revision.id,
    });

    await castApprove(panelists[0].token, reviewCase.id);
    await castApprove(panelists[1].token, reviewCase.id);

    const { data: s } = await admin
      .from("subjects")
      .select("slug")
      .eq("id", subject.id)
      .single();
    expect(s?.slug).toBe("graph-theory-2");
  });

  it("repoints only current_revision_id on an approved edit", async () => {
    const { base, guide } = await createPublishedGuide({
      title: "Groups",
      variantSlug: "main",
    });
    const edit = await createGuideRevision(guide.id, { title: "Groups v2" });
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_edit",
      seats: 3,
      revisionId: edit.id,
    });

    await castApprove(panelists[0].token, reviewCase.id);
    await castApprove(panelists[1].token, reviewCase.id);

    expect(await caseStatus(reviewCase.id)).toBe("approved");
    const { data: g } = await admin
      .from("guides")
      .select("current_revision_id, slug")
      .eq("id", guide.id)
      .single();
    expect(g?.current_revision_id).toBe(edit.id);
    expect(g?.slug).toBe("main");

    const { data: b } = await admin
      .from("guide_bases")
      .select("canonical_guide_id")
      .eq("id", base.id)
      .single();
    expect(b?.canonical_guide_id).toBe(guide.id);
  });

  it("rejects the case and publishes nothing on a rejecting majority", async () => {
    const base = await createGuideBase();
    const guide = await createGuide(base.id);
    const revision = await createGuideRevision(guide.id, { title: "Fields" });
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_publish",
      seats: 3,
      revisionId: revision.id,
    });

    for (const p of [panelists[0], panelists[1]]) {
      await app.request(
        `/reviews/cases/${reviewCase.id}/decisions`,
        jsonAuth(p.token, "POST", {
          decision: "rejected",
          notes: "Inaccurate throughout.",
          reasons: ["factual_error"],
        }),
        env
      );
    }

    expect(await caseStatus(reviewCase.id)).toBe("rejected");
    const { data: g } = await admin
      .from("guides")
      .select("status")
      .eq("id", guide.id)
      .single();
    expect(g?.status).toBe("draft");
  });

  it("keeps the case open when no majority has formed", async () => {
    const base = await createGuideBase();
    const guide = await createGuide(base.id);
    const revision = await createGuideRevision(guide.id, { title: "Measure" });
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_publish",
      seats: 3,
      revisionId: revision.id,
    });

    await castApprove(panelists[0].token, reviewCase.id);

    expect(await caseStatus(reviewCase.id)).toBe("in_review");
    const panels = await panelsFor(reviewCase.id);
    expect(panels[0].closed_at).toBeNull();
  });
});
