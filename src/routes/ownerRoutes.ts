// owner create, delete and update admin and member and view all documents and users and sign documents and view all signed documents and view all unsigned documents and view all pending documents and view all rejected documents and view all approved documents and view all expired documents and view all revoked documents and view all suspended documents and view all active documents and view all inactive documents and view all archived documents and view all trashed documents and view all flagged documents and view all unflagged documents and view all reported documents and view all unreported documents and view all verified documents and view all unverified documents and view all pending verification documents and view all rejected verification documents and view all approved verification documents and view all expired verification documents and view all revoked verification documents and view all suspended verification documents and view all active verification documents and view all inactive verification documents and view all archived verification documents and view all trashed verification documents and view all flagged verification documents and view all unflagged verification documents and view all reported verification documents and view all unreported verification documents
import { Router } from "express";
import { requireOwner } from "../lib/auth.js";

export const ownerRouter = Router();

// Middleware to require owner access for all routes in this router
ownerRouter.use(requireOwner);
