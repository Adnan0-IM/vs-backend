import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { mockPrismaClient, resetAllMocks, mockGetSession, mockGetActiveMember } from "./setup.js";
import app from "../src/index.js";

beforeEach(() => {
  resetAllMocks();
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
    mockGetSession.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/organization/generate-keys")
      .send({ orgId: "org1" })
      .expect(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("POST /api/organization/generate-keys -> 403 when not a member", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1" },
    });
    mockGetActiveMember.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/organization/generate-keys")
      .send({ orgId: "org1" })
      .expect(403);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/documents/verify/:token -> 404 when token not found", async () => {
    mockPrismaClient.signedDocument.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/documents/verify/notexists")
      .expect(404);
    expect(res.body).toHaveProperty("result", "NOT_FOUND");
  });
});