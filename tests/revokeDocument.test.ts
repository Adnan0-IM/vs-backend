import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";

// Mock auth and prisma client before importing controllers/app
vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  const auth = { api: { getSession, getActiveMember } };

  const client = {
    member: { findFirst: vi.fn() },
    signedDocument: { updateMany: vi.fn() },
  };

  return { auth, client, __mocks: { getSession, getActiveMember } };
});

import { revokeDocument } from "../src/controllers/documentController.js";
import app from "../src/index.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  authMocks.getSession.mockReset();
  authMocks.getActiveMember.mockReset();
  (client.member.findFirst as any).mockReset();
  (client.signedDocument.updateMany as any).mockReset();
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
    (client.member.findFirst as any).mockResolvedValue({ role: "member" });
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
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.signedDocument.updateMany as any).mockResolvedValue({ count: 0 });
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
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.signedDocument.updateMany as any).mockResolvedValue({ count: 1 });
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
    authMocks.getSession.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/revoke -> 403 when not owner/admin", async () => {
    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    (client.member.findFirst as any).mockResolvedValue({ role: "member" });

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(403);
  });

  it("POST /api/documents/revoke -> 200 on success", async () => {
    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.signedDocument.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/api/documents/revoke")
      .send({ documentId: "d1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });
});
