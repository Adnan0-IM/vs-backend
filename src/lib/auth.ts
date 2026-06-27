import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins"
import { createAuthMiddleware } from "better-auth/api";

const client = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(client, { provider: "postgresql" }),
  plugins: [admin({defaultRole: "admin"})],
  trustedOrigins: ["https://vs.adnanilyas.dev"],
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true, autoSignIn: false },

});
