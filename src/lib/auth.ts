import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { ac, orgOwner, orgAdmin, signer, viewer } from "./permissions.js";

export const client = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(client, { provider: "postgresql" }),
  plugins: [
    organization({
      ac,
      roles: {
        owner: orgOwner,
        admin: orgAdmin,
        signer, 
        viewer, 
      },
    }),
  ],
  trustedOrigins: [
    "https://vs.adnanilyas.dev",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true, autoSignIn: false },
});

export {
  requireOwner,
  requireAdmin,
} from "../middlewares/authMiddleware.js";
