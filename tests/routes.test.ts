import { vi, describe, it, beforeEach, expect } from "vitest";

// Mock auth and prisma client before importing the app
vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  const auth = { api: { getSession, getActiveMember } };

  const client = {
    member: { findFirst: vi.fn() },
    organization: { update: vi.fn(), findUnique: vi.fn() },
    signedDocument: { findUnique: vi.fn(), findFirst: vi.fn() },
    verificationLog: { create: vi.fn() },
  };

  return { auth, client, __mocks: { getSession, getActiveMember } };
});

import request from "supertest";
import app from "../src/index.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";

beforeEach(() => {
  // reset mocked implementations
  authMocks.getSession.mockReset();
  authMocks.getActiveMember.mockReset();
  (client.member.findFirst as any).mockReset();
  (client.signedDocument.findUnique as any).mockReset();
});

describe("HTTP routes", () => {
  it("GET / returns html home page", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.text).toContain("VeriDoc");
  });

  it("GET /healthz returns status ok", async () => {
    const res = await request(app).get("/healthz").expect(200);
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("POST /api/organization/generate-keys -> 401 when unauthenticated", async () => {
    authMocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/organization/generate-keys")
      .send({ orgId: "org1" })
      .expect(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("POST /api/organization/generate-keys -> 403 when not a member", async () => {
    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1" },
    });
    (client.member.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/organization/generate-keys")
      .send({ orgId: "org1" })
      .expect(403);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/documents/verify/:token -> 404 when token not found", async () => {
    (client.signedDocument.findUnique as any).mockResolvedValue(null);
    const res = await request(app)
      .get("/api/documents/verify/notexists")
      .expect(404);
    expect(res.body).toHaveProperty("result", "NOT_FOUND");
  });
});
