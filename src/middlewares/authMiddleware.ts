import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { Request, Response, NextFunction } from "express";

interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
}

interface Session {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
    activeOrganizationId?: string | null | undefined;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = session.user;
  req.session = session.session;
  next();
}

export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const activeMember = await auth.api.getActiveMember({
    headers: fromNodeHeaders(req.headers),
  });

  if (!activeMember || activeMember.role !== "owner") {
    return res.status(403).json({ error: "Forbidden: Owner access required" });
  }

  req.user = session.user;
  req.session = session.session;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const activeMember = await auth.api.getActiveMember({
    headers: fromNodeHeaders(req.headers),
  });

  if (
    !activeMember ||
    (activeMember.role !== "admin" && activeMember.role !== "owner")
  ) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }

  req.user = session.user;
  req.session = session.session;
  next();
}
