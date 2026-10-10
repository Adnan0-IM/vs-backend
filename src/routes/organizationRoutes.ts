import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  generateKeys,
  getDashboardStats,
} from "../controllers/organizationController.js";

export const organizationRouter = Router();

organizationRouter.post("/generate-keys", requireAuth, generateKeys);

organizationRouter.get("/dashboard-stats", requireAuth, getDashboardStats);
