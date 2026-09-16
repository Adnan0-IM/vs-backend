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

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(() => {
  server.resetHandlers();
  resetAllMocks();
});

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
    mockPrismaClient.signedDocument.create.mockResolvedValue({ id: "doc1" });

    (UTApi as any).uploadResponse = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];

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