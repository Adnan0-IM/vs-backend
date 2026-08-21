import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock external dependencies used by the controller
vi.mock("../src/lib/auth.js", () => {
  const mock = {
    member: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    signedDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    verificationLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  };
  return { client: mock };
});

vi.mock("../src/services/cryptoService.js", () => ({
  hashDocument: vi.fn(() => "test-hash"),
  signHash: vi.fn(() => "sig-base64"),
  decryptPrivateKey: vi.fn(
    () => "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  ),
  verifySignature: vi.fn(() => true),
}));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
}));

// Minimal pdf-lib mock that supports the used APIs
vi.mock("pdf-lib", async () => {
  return {
    PDFDocument: {
      load: vi.fn(async (_buf: Uint8Array) => {
        return {
          getPages: () => [
            {
              getSize: () => ({ width: 200, height: 300 }),
              drawImage: vi.fn(),
            },
          ],
          embedPng: async (_buf: Uint8Array) => ({
            /* image placeholder */
          }),
          save: async () => new Uint8Array(Buffer.from("fake-pdf-bytes")),
        };
      }),
    },
  };
});

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

import { uploadAndSign } from "../src/controllers/documentController.js";
import { client } from "../src/lib/auth.js";
import { UTApi } from "uploadthing/server";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  // Reset mocks
  (client.member.findFirst as any).mockReset();
  (client.organization.findUnique as any).mockReset();
  (client.signedDocument.create as any).mockReset();
});

describe("uploadAndSign controller", () => {
  it("returns 400 when missing required fields", async () => {
    const req: any = { body: {} };
    const res = makeRes();
    const next = vi.fn();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing required fields" });
  });

  it("returns 401 when user not authenticated", async () => {
    const req: any = {
      body: {
        title: "t",
        fileUrl: "u",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
    };
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized: User not authenticated",
    });
  });

  it("returns 400 when no active organization selected", async () => {
    const req: any = {
      body: {
        title: "t",
        fileUrl: "u",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: {},
    };
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "No active organization selected",
    });
  });

  it("returns 403 when user is not a member", async () => {
    const req: any = {
      body: {
        title: "t",
        fileUrl: "u",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    (client.member.findFirst as any).mockResolvedValue(null);
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: You are not a member of this organization",
    });
  });

  it("returns 403 when member does not have signer/admin/owner role", async () => {
    const req: any = {
      body: {
        title: "t",
        fileUrl: "u",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    (client.member.findFirst as any).mockResolvedValue({ role: "member" });
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: You do not have permissions to sign documents",
    });
  });

  it("returns 400 when organization keys missing", async () => {
    const req: any = {
      body: {
        title: "t",
        fileUrl: "u",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    (client.member.findFirst as any).mockResolvedValue({ role: "signer" });
    (client.organization.findUnique as any).mockResolvedValue({});
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Organization keys not found. Please generate RSA keys in organization settings first.",
    });
  });

  it("returns 400 when fetch of file fails", async () => {
    // mock fetch to fail
    globalThis.fetch = vi.fn(async () => ({ ok: false }) as any);

    const req: any = {
      body: {
        title: "t",
        fileUrl: "http://bad.url/file.pdf",
        originalFilename: "f",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
    };
    (client.member.findFirst as any).mockResolvedValue({ role: "signer" });
    (client.organization.findUnique as any).mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to download file from UploadThing url.",
    });
  });

  it("successfully signs and uploads document", async () => {
    // mock fetch to return ok and an ArrayBuffer
    globalThis.fetch = vi.fn(
      async () =>
        ({ ok: true, arrayBuffer: async () => Buffer.from("pdf-data") }) as any,
    );

    (client.member.findFirst as any).mockResolvedValue({ role: "owner" });
    (client.organization.findUnique as any).mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });

    // Ensure the controller's module-level utapi instance uses these mocked methods
    (UTApi as any).uploadResponse = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];
    (UTApi as any).deleteResponse = true;

    (client.signedDocument.create as any).mockResolvedValue({
      id: "doc1",
      title: "t",
    });

    const req: any = {
      body: {
        title: "t",
        fileUrl: "http://good.url/file.pdf",
        originalFilename: "f.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
      },
      user: { id: "u1" },
      session: { activeOrganizationId: "org1" },
      headers: { origin: "http://localhost:5173" },
    };

    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
    const callArg = (res.json as any).mock.calls[0][0];
    expect(callArg.success).toBe(true);
    expect(callArg.document).toBeDefined();
  });
});
