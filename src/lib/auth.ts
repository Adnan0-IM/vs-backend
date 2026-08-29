import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { ac, orgOwner, orgAdmin, orgMember } from "./permissions.js";
import {
  generateInvitationLink,
  sendInvitationEmail,
} from "../services/emailService.js";
import { prisma } from "./prisma.js";
import "dotenv/config";


export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    organization({
      ac,
      roles: {
        owner: orgOwner,
        admin: orgAdmin,
        member: orgMember,
      },

      async sendInvitationEmail(data) {
        try {
          console.log("SendInvitationEmail hook called for:", data.email);

          // data.id = invitation ID
          // data.email = recipient
          // data.inviter.user = { name, email } of the person inviting
          // data.organization = { name, id, slug }
          // data.role = the role being invited to

          const inviteLink = await generateInvitationLink(data.id);

          await sendInvitationEmail(
            data.email,
            data.organization.name,
            inviteLink,
            data.role,
          );

          console.log("Invitation email sent successfully");
        } catch (error) {
          // Log but DON'T throw — Better Auth will crash the request if you throw
          console.error("Error in sendInvitationEmail hook:", error);
        }
      },
    }),
  ],
  trustedOrigins: [
    "https://vs.adnanilyas.dev",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
});

export { requireOwner, requireAdmin } from "../middlewares/authMiddleware.js";
