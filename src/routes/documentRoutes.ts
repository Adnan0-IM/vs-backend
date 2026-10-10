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

documentRouter.post("/upload-and-sign", requireAuth, uploadAndSign);
documentRouter.get("/list", requireAuth, listDocuments);
documentRouter.post("/revoke", requireAuth, revokeDocument);
documentRouter.get("/verification-logs", requireAuth, getVerificationLogs);

documentRouter.get("/verify/:token", verifyDocumentByToken);
documentRouter.post("/verify-file", verifyDocumentByFile);
