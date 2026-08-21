import { vi, describe, it, beforeEach, expect } from "vitest";

// Mock dependencies before importing the app so controllers pick up mocks
vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  const auth = { api: { getSession, getActiveMember } };

  const client = {
    member: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    signedDocument: { create: vi.fn() },
    verificationLog: { create: vi.fn() },
  };

  return { auth, client, __mocks: { getSession, getActiveMember } };
});

vi.mock("../src/services/cryptoService.js", () => ({
  hashDocument: vi.fn(() => "test-hash"),
  signHash: vi.fn(() => "sig-base64"),
  decryptPrivateKey: vi.fn(
    () => "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  ),
}));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
}));

vi.mock("pdf-lib", async () => ({
  PDFDocument: {
    load: vi.fn(async (_buf: Uint8Array) => ({
      getPages: () => [
        { getSize: () => ({ width: 200, height: 300 }), drawImage: vi.fn() },
      ],
      embedPng: async () => ({}),
      save: async () => new Uint8Array(Buffer.from("fake-pdf")),
    })),
  },
}));

vi.mock("uploadthing/server", () => {
  class MockUTApi {
    static uploadResponse: any = [];
    static deleteResponse: any = true;
    uploadFiles() {
      return Promise.resolve((MockUTApi as any).uploadResponse);
    }
    deleteFiles() {
      return Promise.resolve((MockUTApi as any).deleteResponse);
    }
  }
  return { UTApi: MockUTApi };
});

// Provide a fetch mock so controllers don't perform real network calls
vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => Buffer.from("pdf-data"),
  })) as any,
);

import request from "supertest";
import app from "../src/index.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";
import { UTApi } from "uploadthing/server";

beforeEach(() => {
  authMocks.getSession.mockReset();
  authMocks.getActiveMember.mockReset();
  (client.member.findFirst as any).mockReset();
  (client.organization.findUnique as any).mockReset();
  (client.signedDocument.create as any).mockReset();
});

describe("Upload endpoints (integration)", () => {
  it("POST /api/documents/upload-and-sign returns 401 when unauthenticated", async () => {
    authMocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/documents/upload-and-sign")
      .send({});
    expect(res.status).toBe(401);
  });

  it("POST /api/documents/upload-and-sign signs and returns 201 on success", async () => {
    // Setup authenticated session
    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });

    (UTApi as any).uploadResponse = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];

    (client.signedDocument.create as any).mockResolvedValue({
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
