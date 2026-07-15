import { Request, Response } from "express";
import { client } from "../lib/auth.js";
import { generateKeyPair, encryptPrivateKey } from "../services/cryptoService.js";

/**
 * Generate RSA key pair for organization and store public key + encrypted private key in the DB.
 * Endpoint: POST /api/organization/generate-keys
 */
export async function generateKeys(req: Request, res: Response) {
  try {
    const { orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required in request body" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User not authenticated" });
    }

    // Verify user is member of the organization and has owner or admin role
    const member = await client.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member) {
      return res.status(403).json({ error: "Forbidden: You are not a member of this organization" });
    }

    if (member.role !== "owner" && member.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only owners and admins can generate organization keys" });
    }

    // Generate RSA Key Pair
    const { publicKey, privateKey } = generateKeyPair();

    // Encrypt the Private Key before storing it
    const privateKeyEncrypted = encryptPrivateKey(privateKey);

    const organization = await client.organization.update({
      where: { id: orgId },
      data: {
        publicKey,
        privateKeyEncrypted,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Keys generated and stored successfully",
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        metadata: organization.metadata,
        publicKey: organization.publicKey,
        createdAt: organization.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error generating keys:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Fetch organization statistics, recent documents, and verification activities.
 * Endpoint: GET /api/organization/dashboard-stats
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const { orgId } = req.query as { orgId: string };
    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User not authenticated" });
    }

    // Verify user is a member of the organization
    const member = await client.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member) {
      return res.status(403).json({ error: "Forbidden: You are not a member of this organization" });
    }

    // 1. Fetch organization details
    const organizationRaw = await client.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        metadata: true,
        publicKey: true,
        createdAt: true,
      },
    });

    if (!organizationRaw) {
      return res.status(404).json({ error: "Organization not found" });
    }

    let orgType = null;
    if (organizationRaw.metadata) {
      try {
        const parsed = JSON.parse(organizationRaw.metadata);
        orgType = parsed.type || null;
      } catch (e) {
        // Ignore parsing errors
      }
    }

    const organization = {
      id: organizationRaw.id,
      name: organizationRaw.name,
      slug: organizationRaw.slug,
      logo: organizationRaw.logo,
      publicKey: organizationRaw.publicKey,
      createdAt: organizationRaw.createdAt,
      type: orgType,
    };


    // 2. Fetch stats
    const totalDocuments = await client.signedDocument.count({
      where: { organizationId: orgId },
    });

    const activeDocuments = await client.signedDocument.count({
      where: { organizationId: orgId, status: "ACTIVE" },
    });

    const revokedDocuments = await client.signedDocument.count({
      where: { organizationId: orgId, status: "REVOKED" },
    });

    // Fetch total verification logs for all organization documents
    const verificationLogsCount = await client.verificationLog.count({
      where: {
        document: {
          organizationId: orgId,
        },
      },
    });

    const successfulVerifications = await client.verificationLog.count({
      where: {
        document: {
          organizationId: orgId,
        },
        verificationResult: "VERIFIED",
      },
    });

    const verificationSuccessRate = verificationLogsCount > 0 
      ? Math.round((successfulVerifications / verificationLogsCount) * 100) 
      : 100;

    // 3. Fetch recent documents
    const recentDocuments = await client.signedDocument.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        originalFilename: true,
        fileUrl: true,
        fileSize: true,
        status: true,
        createdAt: true,
        signer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // 4. Fetch recent verification activity / logs
    const recentActivity = await client.verificationLog.findMany({
      where: {
        document: {
          organizationId: orgId,
        },
      },
      orderBy: { verificationTimestamp: "desc" },
      take: 10,
      include: {
        document: {
          select: {
            title: true,
          },
        },
      },
    });

    return res.status(200).json({
      organization,
      stats: {
        totalDocuments,
        activeDocuments,
        revokedDocuments,
        totalVerifications: verificationLogsCount,
        verificationSuccessRate,
      },
      recentDocuments,
      recentActivity,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

