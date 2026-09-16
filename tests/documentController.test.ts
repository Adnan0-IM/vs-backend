import { vi, describe, it, expect, beforeEach } from "vitest";
import { mockPrismaClient, resetAllMocks } from "./setup.js";
import { uploadAndSign } from "../src/controllers/documentController.js";
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

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  resetAllMocks();
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
    mockPrismaClient.member.findFirst.mockResolvedValue(null);
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
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "member" });
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
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "signer" });
    mockPrismaClient.organization.findUnique.mockResolvedValue({});
    const res = makeRes();

    await uploadAndSign(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Organization keys not found. Please generate RSA keys in organization settings first.",
    });
  });

  it("returns 400 when fetch of file fails", async () => {
    const mockFetch = vi.fn(async () => ({ ok: false }) as any) as unknown as typeof fetch;
    mockFetch.preconnect = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

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
    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "signer" });
    mockPrismaClient.organization.findUnique.mockResolvedValue({
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
    const mockFetch = vi.fn(
      async () =>
        ({ ok: true, arrayBuffer: async () => Buffer.from("pdf-data") }) as any,
    ) as unknown as typeof fetch;
    mockFetch.preconnect = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    mockPrismaClient.member.findFirst.mockResolvedValue({ role: "owner" });
    mockPrismaClient.organization.findUnique.mockResolvedValue({
      publicKey: "pub",
      privateKeyEncrypted: "enc",
    });

    (UTApi as any).uploadResponse = [
      { data: { ufsUrl: "https://cdn.example/signed.pdf" } },
    ];
    (UTApi as any).deleteResponse = true;

    mockPrismaClient.signedDocument.create.mockResolvedValue({
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