import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the auth module before importing the middleware
vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn();
  const getActiveMember = vi.fn();
  return {
    auth: { api: { getSession, getActiveMember } },
    __mocks: { getSession, getActiveMember },
  };
});

import {
  requireAuth,
  requireOwner,
  requireAdmin,
} from "../src/middlewares/authMiddleware.js";
import { __mocks as authMocks } from "../src/lib/auth.js";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  authMocks.getSession.mockReset();
  authMocks.getActiveMember.mockReset();
});

describe("authMiddleware", () => {
  it("requireAuth -> returns 401 when no session", async () => {
    authMocks.getSession.mockResolvedValue(null);
    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth -> sets req.user and req.session and calls next when session exists", async () => {
    const sessionObj = {
      user: { id: "u1", name: "Test" },
      session: { id: "s1", activeOrganizationId: "org1" },
    };
    authMocks.getSession.mockResolvedValue(sessionObj);

    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(sessionObj.user);
    expect(req.session).toEqual(sessionObj.session);
  });

  it("requireOwner -> returns 401 when no session", async () => {
    authMocks.getSession.mockResolvedValue(null);
    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireOwner -> returns 403 when activeMember missing or not owner", async () => {
    const sessionObj = { user: { id: "u1" }, session: { id: "s1" } };
    authMocks.getSession.mockResolvedValue(sessionObj);
    authMocks.getActiveMember.mockResolvedValue(null);

    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: Owner access required",
    });
    expect(next).not.toHaveBeenCalled();

    // Non-owner role
    authMocks.getActiveMember.mockResolvedValue({ role: "admin" });
    authMocks.getSession.mockResolvedValue(sessionObj);

    const res2 = makeRes();
    const next2 = vi.fn();
    await requireOwner(req, res2, next2);
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(next2).not.toHaveBeenCalled();
  });

  it("requireOwner -> calls next when role is owner", async () => {
    const sessionObj = { user: { id: "u1" }, session: { id: "s1" } };
    authMocks.getSession.mockResolvedValue(sessionObj);
    authMocks.getActiveMember.mockResolvedValue({ role: "owner" });

    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireOwner(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(sessionObj.user);
    expect(req.session).toEqual(sessionObj.session);
  });

  it("requireAdmin -> denies when not admin/owner", async () => {
    const sessionObj = { user: { id: "u1" }, session: { id: "s1" } };
    authMocks.getSession.mockResolvedValue(sessionObj);
    authMocks.getActiveMember.mockResolvedValue({ role: "member" });

    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: Admin access required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin -> allows admin and owner roles", async () => {
    const sessionObj = { user: { id: "u1" }, session: { id: "s1" } };
    authMocks.getSession.mockResolvedValue(sessionObj);
    authMocks.getActiveMember.mockResolvedValue({ role: "admin" });

    const req: any = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();

    // owner should also pass
    authMocks.getActiveMember.mockResolvedValue({ role: "owner" });
    const res2 = makeRes();
    const next2 = vi.fn();
    await requireAdmin(req, res2, next2);
    expect(next2).toHaveBeenCalled();
  });
});
