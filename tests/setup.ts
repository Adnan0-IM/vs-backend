// Minimal test setup for Vitest
import "node:process";
import { vi } from "vitest";

// Ensure a predictable secret for crypto service tests
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-secret-for-crypto-service-setup";

if (typeof globalThis.fetch !== "function") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetch } = await import("undici");
    // @ts-ignore
    globalThis.fetch = fetch;
  } catch (e) {
  }
}

// Global Prisma mock - provides a mock client for all tests
const createMockPrismaClient = () => ({
  member: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  signedDocument: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  verificationLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
});

export const mockPrismaClient = createMockPrismaClient();

// Mock the prisma module globally
vi.mock("../src/lib/prisma.js", () => ({
  prisma: mockPrismaClient,
  default: mockPrismaClient,
}));

// Mock better-auth to avoid initialization issues
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(),
      getActiveMember: vi.fn(),
    },
  })),
  prismaAdapter: vi.fn(() => ({})),
}));

// Mock better-auth plugins
vi.mock("better-auth/plugins", () => ({
  organization: vi.fn(),
}));

// Mock email service
vi.mock("../src/services/emailService.js", () => ({
  generateInvitationLink: vi.fn(),
  sendInvitationEmail: vi.fn(),
}));

// Mock permissions
vi.mock("../src/lib/permissions.js", () => ({
  ac: {},
  orgOwner: {},
  orgAdmin: {},
  orgMember: {},
  requireOwner: vi.fn(),
  requireAdmin: vi.fn(),
}));


// Mock qrcode
vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
}));

// Mock pdf-lib
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

// Mock uploadthing
const mockUploadResponse = [{ data: { ufsUrl: "https://cdn.example/signed.pdf" } }];
const mockDeleteResponse = true;

vi.mock("uploadthing/server", () => {
  class MockUTApi {
    static uploadResponse: any = mockUploadResponse;
    static deleteResponse: any = mockDeleteResponse;
    uploadFiles() {
      return Promise.resolve((MockUTApi as any).uploadResponse);
    }
    deleteFiles() {
      return Promise.resolve((MockUTApi as any).deleteResponse);
    }
  }
  return { UTApi: MockUTApi };
});

// Mock fetch globally
const mockFetch = vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => Buffer.from("pdf-data"),
}));
mockFetch.preconnect = vi.fn();
vi.stubGlobal("fetch", mockFetch as any);

// Mock better-auth
const mockGetSession = vi.fn();
const mockGetActiveMember = vi.fn();

vi.mock("../src/lib/auth.js", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
      getActiveMember: mockGetActiveMember,
    },
  },
  __mocks: { getSession: mockGetSession, getActiveMember: mockGetActiveMember },
}));

// Mock better-auth plugins
vi.mock("better-auth/plugins", () => ({
  organization: vi.fn(),
}));

// Mock email service
vi.mock("../src/services/emailService.js", () => ({
  generateInvitationLink: vi.fn(),
  sendInvitationEmail: vi.fn(),
}));

// Mock permissions
vi.mock("../src/lib/permissions.js", () => ({
  ac: {},
  orgOwner: {},
  orgAdmin: {},
  orgMember: {},
  requireOwner: vi.fn(),
  requireAdmin: vi.fn(),
}));

// Mock crypto service - tests that need real crypto should unmock or override
// vi.mock("../src/services/cryptoService.js", () => ({
//   hashDocument: vi.fn(() => "test-hash"),
//   signHash: vi.fn(() => "sig-base64"),
//   verifySignature: vi.fn(() => true),
//   decryptPrivateKey: vi.fn(() => "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"),
//   generateKeyPair: vi.fn(() => ({ publicKey: "pub", privateKey: "priv" })),
//   encryptPrivateKey: vi.fn((pk: string) => "enc:" + pk.slice(0, 10)),
// }));

// Mock qrcode
vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
}));

// Mock pdf-lib
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

// Helper to reset all mocks between tests
export function resetAllMocks() {
  // Reset prisma mocks
  Object.values(mockPrismaClient).forEach((model: any) => {
    Object.values(model).forEach((fn: any) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
  });
  
  // Reset global fetch
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => Buffer.from("pdf-data"),
  });
  
  // Reset auth mocks
  mockGetSession.mockReset();
  mockGetActiveMember.mockReset();
  
  // Reset UTApi static responses
  mockUploadResponse.length = 0;
  mockUploadResponse.push({ data: { ufsUrl: "https://cdn.example/signed.pdf" } });
}

export { mockGetSession, mockGetActiveMember };