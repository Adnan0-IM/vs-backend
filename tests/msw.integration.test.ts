import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http } from "msw";
import request from "supertest";

// Mock auth and client similar to other tests
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

// Mock pdf-lib to avoid parsing a real PDF in tests
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

// Ensure uploadthing UTApi returns a success by default
vi.mock("uploadthing/server", () => {
  class MockUTApi {
    static uploadResponse: any = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];
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

import app from "../src/index.js";
import { client, __mocks as authMocks } from "../src/lib/auth.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

describe("MSW integration: external file download", () => {
  it("returns 201 when external file download succeeds (MSW mock)", async () => {
    // Mock the external file URL
    server.use(
      http.get("https://files.example.test/original.pdf", (req) => {
        return new Response(Buffer.from("%PDF-1.4 fake pdf content"), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }),
    );

    // Auth and DB mocks
    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });
    (client.signedDocument.create as any).mockResolvedValue({ id: "doc1" });

    const res = await request(app)
      .post("/api/documents/upload-and-sign")
      .send({
        title: "T",
        fileUrl: "https://files.example.test/original.pdf",
        originalFilename: "f.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
  });

  it("returns 400 when external file download fails (MSW mock)", async () => {
    server.use(
      http.get("https://files.example.test/original.pdf", (req) => {
        return new Response(null, { status: 500 });
      }),
    );

    authMocks.getSession.mockResolvedValue({
      user: { id: "u1" },
      session: { id: "s1", activeOrganizationId: "org1" },
    });
    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });

    const res = await request(app)
      .post("/api/documents/upload-and-sign")
      .send({
        title: "T",
        fileUrl: "https://files.example.test/original.pdf",
        originalFilename: "f.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Failed to download file from UploadThing url.",
    );
  });
});
