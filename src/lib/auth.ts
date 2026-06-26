import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const client = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(client, { provider: "postgresql" }),
  trustedOrigins: ["http://localhost:5173", "https://vs.adnanilyas.dev"],
  baseURL: "http://localhost:3000/",
  emailAndPassword: { enabled: true },
});
