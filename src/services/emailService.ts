import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}


export async function sendInvitationEmail(
  email: string,
  orgName: string,
  inviteLink: string,
  role: string,
) {
  try {
    const roleDescription = getRoleDescription(role);

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: email,
      subject: `You've been invited to join ${orgName} on VeriDoc`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ca3500;">You've been invited to join ${orgName}</h2>
          
          <p>You have been invited to join <strong>${orgName}</strong> as a <strong>${roleDescription}</strong> on VeriDoc.</p>
          
          <p>VeriDoc is a platform for issuing and verifying digitally signed documents.</p>
          
          <p>Click the button below to accept the invitation:</p>
          
          <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #ca3500; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Accept Invitation</a>
          
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${inviteLink}">${inviteLink}</a></p>
          
          <p>This invitation will expire in 7 days.</p>
          
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 14px; color: #6b7280;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending invitation email:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error("Error in sendInvitationEmail:", err);
    throw err;
  }
}


function getRoleDescription(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "Organization Owner";
    case "admin":
      return "Administrator";
    case "member":
      return "Member";
    default:
      return role;
  }
}


export async function generateInvitationLink(
  invitationId: string,
): Promise<string> {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  return `${baseUrl}/invitation/${invitationId}`;
}
