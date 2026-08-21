import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";

// Mock auth and database client similar to other tests
vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  const auth = { api: { getSession, getActiveMember } };

  const client = {
    member: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    signedDocument: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    verificationLog: { create: vi.fn(), findMany: vi.fn() },
  };

  return { auth, client, __mocks: { getSession, getActiveMember } };
});

vi.mock("../src/services/cryptoService.js", () => ({
  hashDocument: vi.fn(() => "test-hash"),
  verifySignature: vi.fn(() => true),
}));

import app from "../src/index.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";

beforeEach(() => {
  authMocks.getSession.mockReset();
  authMocks.getActiveMember.mockReset();
  (client.signedDocument.findUnique as any).mockReset();
  (client.signedDocument.findFirst as any).mockReset();
  (client.verificationLog.create as any).mockReset();
});

describe("Verification endpoints", () => {
  it("GET /api/documents/verify/:token returns 404 when token not found", async () => {
    (client.signedDocument.findUnique as any).mockResolvedValue(null);

    const res = await request(app).get("/api/documents/verify/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("result", "NOT_FOUND");
  });

  it("GET /api/documents/verify/:token returns VERIFIED when document intact and signature valid", async () => {
    // Document in DB
    (client.signedDocument.findUnique as any).mockResolvedValue({
      id: "doc1",
      fileUrl: "https://cdn.example/test.pdf",
      documentHash: "test-hash",
      digitalSignature: "sig",
      status: "ACTIVE",
      title: "T",
      originalFilename: "f.pdf",
      fileSize: 10,
      createdAt: new Date(),
      organization: { id: "org1", name: "Org", publicKey: "pubkey" },
    });

    // fetch should return bytes whose hash equals documentHash (we mock hashDocument)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Buffer.from("pdf-bytes"),
      })) as any,
    );

    const res = await request(app).get("/api/documents/verify/sometoken");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("verified", true);
    expect(res.body).toHaveProperty("result", "VERIFIED");
  });

  it("GET /api/documents/verify/:token returns TAMPERED when file cannot be fetched", async () => {
    (client.signedDocument.findUnique as any).mockResolvedValue({
      id: "doc2",
      fileUrl: "https://cdn.example/missing.pdf",
      documentHash: "test-hash",
      digitalSignature: "sig",
      status: "ACTIVE",
      title: "T2",
      originalFilename: "f2.pdf",
      fileSize: 10,
      createdAt: new Date(),
      organization: { id: "org1", name: "Org", publicKey: "pubkey" },
    });

    // Simulate fetch failure
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })) as any);

    const res = await request(app).get("/api/documents/verify/sometoken2");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("result", "TAMPERED");
    // verificationLog should be created
    expect(
      (client.verificationLog.create as any).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/documents/verify-file returns 400 when fileUrl missing", async () => {
    const res = await request(app).post("/api/documents/verify-file").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/documents/verify-file returns NOT_FOUND when no matching hash", async () => {
    // fetch returns file bytes
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Buffer.from("pdf-bytes"),
      })) as any,
    );
    (client.signedDocument.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/documents/verify-file")
      .send({ fileUrl: "https://cdn.example/uploaded.pdf" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("result", "NOT_FOUND");
  });

  it("POST /api/documents/verify-file returns VERIFIED when matching document and signature valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Buffer.from("pdf-bytes"),
      })) as any,
    );

    (client.signedDocument.findFirst as any).mockResolvedValue({
      id: "doc3",
      fileUrl: "https://cdn.example/signed.pdf",
      documentHash: "test-hash",
      digitalSignature: "sig",
      status: "ACTIVE",
      title: "T3",
      originalFilename: "f3.pdf",
      fileSize: 11,
      createdAt: new Date(),
      organization: { id: "org1", name: "Org", publicKey: "pubkey" },
    });

    const res = await request(app)
      .post("/api/documents/verify-file")
      .send({ fileUrl: "https://cdn.example/uploaded.pdf" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("verified", true);
    expect(res.body).toHaveProperty("result", "VERIFIED");
  });
});
