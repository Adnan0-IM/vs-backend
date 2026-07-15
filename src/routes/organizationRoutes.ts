import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  generateKeys,
  getDashboardStats,
} from "../controllers/organizationController.js";

export const organizationRouter = Router();

// Route to generate RSA keys for organization
organizationRouter.post("/generate-keys", requireAuth, generateKeys);

// Route to get dashboard statistics
organizationRouter.get("/dashboard-stats", requireAuth, getDashboardStats);
