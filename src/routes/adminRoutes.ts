import {Router} from "express";
import { requireAdmin } from "../lib/auth.js";

export const adminRouter = Router();

// Middleware to require admin access for all routes in this router
adminRouter.use(requireAdmin);


