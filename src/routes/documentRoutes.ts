import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  uploadAndSign,
  listDocuments,
  revokeDocument,
  verifyDocumentByToken,
  verifyDocumentByFile,
  getVerificationLogs,
} from "../controllers/documentController.js";

export const documentRouter = Router();

// Protected routes (require session and active organization member/signer/admin/owner role)
documentRouter.post("/upload-and-sign", requireAuth, uploadAndSign);
documentRouter.get("/list", requireAuth, listDocuments);
documentRouter.post("/revoke", requireAuth, revokeDocument);
documentRouter.get("/verification-logs", requireAuth, getVerificationLogs);

// Public routes (anyone can scan QR or upload file to verify)
documentRouter.get("/verify/:token", verifyDocumentByToken);
documentRouter.post("/verify-file", verifyDocumentByFile);
