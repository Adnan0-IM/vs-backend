import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { mockPrismaClient, resetAllMocks, mockGetSession, mockGetActiveMember } from "./setup.js";
import app from "../src/index.js";
import { UTApi } from "uploadthing/server";

// Mock crypto service for controller tests
vi.mock("../src/services/cryptoService.js", () => ({
  hashDocument: vi.fn(() => "test-hash"),
  signHash: vi.fn(() => "sig-base64"),
  decryptPrivateKey: vi.fn(
    () => "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  ),
  verifySignature: vi.fn(() => true),
}));

beforeEach(() => {
  resetAllMocks();
});

describe("Upload endpoints (integration)", () => {
  it("POST /api/documents/upload-and-sign returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/documents/upload-and-sign")
      .send({});
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/upload-and-sign signs and returns 201 on success", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    mockGetActiveMember.mockResolvedValue({ role: "owner" });
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "owner" });
    mockPrismaClient.organization.findUnique.mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });

    (UTApi as any).uploadResponse = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];

    mockPrismaClient.signedDocument.create.mockResolvedValue({
      id: "doc1",
      title: "T1",
    });

    const body = {
      title: "Doc",
      fileUrl: "http://example.com/file.pdf",
      originalFilename: "file.pdf",
      fileSize: 123,
      mimeType: "application/pdf",
    };

    const res = await request(app)
      .post("/api/documents/upload-and-sign")
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.document).toBeDefined();
  });
});