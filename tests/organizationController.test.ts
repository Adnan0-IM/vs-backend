import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  const auth = { api: { getSession, getActiveMember } };

  const client = {
    member: { findFirst: vi.fn() },
    organization: { update: vi.fn(), findUnique: vi.fn() },
    signedDocument: { count: vi.fn(), findMany: vi.fn() },
    verificationLog: { count: vi.fn(), findMany: vi.fn() },
  };

  return { auth, client, __mocks: { getSession, getActiveMember } };
});

vi.mock("../src/services/cryptoService.js", () => ({
  generateKeyPair: vi.fn(() => ({ publicKey: "pub", privateKey: "priv" })),
  encryptPrivateKey: vi.fn((pk: string) => "enc:" + pk.slice(0, 10)),
}));

import {
  generateKeys,
  getDashboardStats,
} from "../src/controllers/organizationController.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";
import {
  generateKeyPair,
  encryptPrivateKey,
} from "../src/services/cryptoService.js";

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
  (client.organization.update as any).mockReset();
  (client.organization.findUnique as any).mockReset();
  (client.signedDocument.count as any).mockReset();
  (client.verificationLog.count as any).mockReset();
  (client.signedDocument.findMany as any).mockReset();
  (client.verificationLog.findMany as any).mockReset();
  (generateKeyPair as any).mockClear();
  (encryptPrivateKey as any).mockClear();
});

describe("organizationController.generateKeys", () => {
  it("returns 400 when orgId missing", async () => {
    const req: any = { body: {} };
    const res = makeRes();
    await generateKeys(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const req: any = { body: { orgId: "org1" } };
    const res = makeRes();
    await generateKeys(req, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when not a member", async () => {
    const req: any = { body: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue(null);
    const res = makeRes();
    await generateKeys(req, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when member is not owner/admin", async () => {
    const req: any = { body: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue({ role: "member" });
    const res = makeRes();
    await generateKeys(req, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("generates keys and updates organization on success", async () => {
    const req: any = { body: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.update as any).mockResolvedValue({
      id: "org1",
      name: "Org",
      slug: "org",
      logo: null,
      metadata: null,
      publicKey: "pub",
      createdAt: new Date(),
    });

    const res = makeRes();
    await generateKeys(req, res as any);

    expect(generateKeyPair).toHaveBeenCalled();
    expect(encryptPrivateKey).toHaveBeenCalled();
    expect(client.organization.update).toHaveBeenCalledWith({
      where: { id: "org1" },
      data: { publicKey: "pub", privateKeyEncrypted: expect.any(String) },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as any).mock.calls[0][0];
    expect(body).toHaveProperty("success", true);
    expect(body.organization).toHaveProperty("id", "org1");
  });
});

describe("organizationController.getDashboardStats", () => {
  it("returns 400 when orgId missing", async () => {
    const req: any = { query: {} };
    const res = makeRes();
    await getDashboardStats(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const req: any = { query: { orgId: "org1" } };
    const res = makeRes();
    await getDashboardStats(req, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when not a member", async () => {
    const req: any = { query: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue(null);
    const res = makeRes();
    await getDashboardStats(req, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 404 when organization not found", async () => {
    const req: any = { query: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue(null);
    const res = makeRes();
    await getDashboardStats(req, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns dashboard stats on success", async () => {
    const req: any = { query: { orgId: "org1" }, user: { id: "u1" } };
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue({
      id: "org1",
      name: "Org",
      slug: "org",
      logo: null,
      metadata: JSON.stringify({ type: "Enterprise" }),
      publicKey: "pub",
      createdAt: new Date(),
    });

    (client.signedDocument.count as any).mockImplementation(
      ({ where }: any) => {
        if (where && where.status === "ACTIVE") return Promise.resolve(2);
        if (where && where.status === "REVOKED") return Promise.resolve(1);
        return Promise.resolve(5);
      },
    );

    (client.verificationLog.count as any).mockImplementation(
      ({ where }: any) => {
        if (
          where &&
          where.document &&
          where.document.organizationId === "org1" &&
          where.verificationResult === "VERIFIED"
        )
          return Promise.resolve(3);
        return Promise.resolve(10);
      },
    );

    (client.signedDocument.findMany as any).mockResolvedValue([
      {
        id: "d1",
        title: "T1",
        originalFilename: "f.pdf",
        fileUrl: "u",
        fileSize: 123,
        status: "ACTIVE",
        createdAt: new Date(),
        signer: { name: "S", email: "s@e" },
      },
    ]);

    (client.verificationLog.findMany as any).mockResolvedValue([]);

    const res = makeRes();
    await getDashboardStats(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as any).mock.calls[0][0];
    expect(body).toHaveProperty("organization");
    expect(body).toHaveProperty("stats");
    expect(body.stats).toHaveProperty("totalDocuments");
  });
});
