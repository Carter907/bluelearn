import { describe, it, expect } from "vitest";
import app from "../src/index";
import { clientIp, env, jsonAuth, makeUser } from "./helpers";
import { expectToMatchSpec } from "./openapi";

function guideBody() {
  return {
    knowledge_type: "theoretical" as const,
    title: "Rate Limit Test Guide",
    body: "Body content.",
  };
}

async function createGuide(token: string, ip: string) {
  return app.request("/guides", jsonAuth(token, "POST", guideBody(), ip), env);
}

describe("POST /guides rate limit (CREATE tier)", () => {
  it("allows up to 20 guide creations per user per day", async () => {
    const { token } = await makeUser();
    const ip = clientIp();

    for (let i = 0; i < 20; i++) {
      expect((await createGuide(token, ip)).status).toBe(201);
    }
  });

  it("returns 429 on the 21st guide creation within the same day", async () => {
    const { token } = await makeUser();
    const ip = clientIp();

    for (let i = 0; i < 20; i++) await createGuide(token, ip);

    const res = await createGuide(token, ip);

    expect(res.status).toBe(429);
    await expectToMatchSpec(res, "POST", "/guides");
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Rate limit exceeded");
  });

  it("does not share counters between different users", async () => {
    const first = await makeUser();
    const second = await makeUser();

    for (let i = 0; i < 20; i++) await createGuide(first.token, clientIp());

    expect((await createGuide(second.token, clientIp())).status).toBe(201);
  });

  it("returns 401 (not 429) for unauthenticated requests", async () => {
    const res = await app.request("/guides", { method: "POST" }, env);
    expect(res.status).toBe(401);
  });
});

describe("per-route bucket isolation", () => {
  it("exhausting one route does not spend another route's budget", async () => {
    const { token } = await makeUser();
    const ip = clientIp();

    for (let i = 0; i < 20; i++) await createGuide(token, ip);
    expect((await createGuide(token, ip)).status).toBe(429);

    // Same user, different bucket -- its counter is untouched.
    const res = await app.request(
      "/me",
      jsonAuth(token, "PATCH", { display_name: "Tony" }, ip),
      env
    );
    expect(res.status).toBe(200);
  });
});

describe("global read ceiling (READ tier, keyed by IP)", () => {
  it("caps unauthenticated reads per IP and 429s past the limit", async () => {
    const ip = clientIp();

    for (let i = 0; i < 600; i++) {
      const res = await app.request(
        "/",
        { headers: { "CF-Connecting-IP": ip } },
        env
      );
      expect(res.status).toBe(200);
    }

    const res = await app.request(
      "/",
      { headers: { "CF-Connecting-IP": ip } },
      env
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("does not share the ceiling between IPs", async () => {
    const res = await app.request(
      "/",
      { headers: { "CF-Connecting-IP": clientIp() } },
      env
    );
    expect(res.status).toBe(200);
  });
});

describe("search rate limit (SEARCH tier, keyed by IP)", () => {
  it("429s past 30 searches per IP regardless of the search backend", async () => {
    const ip = clientIp();

    for (let i = 0; i < 30; i++) {
      await app.request(
        "/search?q=test",
        { headers: { "CF-Connecting-IP": ip } },
        env
      );
    }

    const res = await app.request(
      "/search?q=test",
      { headers: { "CF-Connecting-IP": ip } },
      env
    );
    expect(res.status).toBe(429);
  });
});
