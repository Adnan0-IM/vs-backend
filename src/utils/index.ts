import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

/**
 * Helper function to find the active member's role in the organization based on request headers.
 */
export async function findUserRole(reqHeaders: any): Promise<string | null> {
  try {
    const activeMember = await auth.api.getActiveMember({
      headers: fromNodeHeaders(reqHeaders),
    });
    return (activeMember?.role as string) || null;
  } catch (error) {
    console.error("Error finding user role:", error);
    return null;
  }
}
