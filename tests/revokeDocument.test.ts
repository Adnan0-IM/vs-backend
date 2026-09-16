import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { mockPrismaClient, resetAllMocks, mockGetSession, mockGetActiveMember } from "./setup.js";
import { revokeDocument } from "../src/controllers/documentController.js";
import app from "../src/index.js";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  resetAllMocks();
});

describe("revokeDocument controller (unit)", () => {
  it("returns 400 when documentId missing", async () => {
    const req: any = { body: {} };
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "documentId is required" });
  });

  it("returns 401 when unauthenticated", async () => {
    const req: any = { body: { documentId: "d1" } };
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when no active organization", async () => {
    const req: any = {
      body: { documentId: "d1" },
      user: { id: "u1" },
      session: {},
    };
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user not owner/admin", async () => {
    const req: any = {
      body: { documentId: "d1" },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "member" });
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 404 when document not found for organization", async () => {
    const req: any = {
      body: { documentId: "d1" },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "owner" });
    mockPrismaClient.signedDocument.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Document not found or not part of this organization",
    });
  });

  it("returns 200 when revoke succeeds", async () => {
    const req: any = {
      body: { documentId: "d1" },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "owner" });
    mockPrismaClient.signedDocument.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();

    await revokeDocument(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Document revoked successfully",
    });
  });
});

describe("revokeDocument endpoint (integration)", () => {
  it("POST /api/documents/revoke -> 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/revoke -> 403 when not owner/admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    mockGetActiveMember.mockResolvedValue({ role: "member" });

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(403);
  });

  it("POST /api/documents/revoke -> 200 on success", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    mockGetActiveMember.mockResolvedValue({ role: "owner" });
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "owner" });
    mockPrismaClient.signedDocument.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });
});