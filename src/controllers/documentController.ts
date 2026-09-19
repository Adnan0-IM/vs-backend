import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  hashDocument,
  signHash,
  verifySignature,
  decryptPrivateKey,
} from "../services/cryptoService.js";
import {
  computeTLSH,
  compareTLSH,
} from "../services/tlshService.js";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

// Helper to fetch file content as Buffer
async function fetchFileBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Handle document uploading and signing
 * Endpoint: POST /api/documents/upload-and-sign
 */
export async function uploadAndSign(req: Request, res: Response) {
  try {
    const { title, type, fileUrl, originalFilename, fileSize, mimeType } =
      req.body;

    if (!title || !fileUrl || !originalFilename || !fileSize || !mimeType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User not authenticated" });
    }

    const orgId = req.session?.activeOrganizationId;
    if (!orgId) {
      return res.status(400).json({ error: "No active organization selected" });
    }

    // Verify user is member of organization and has owner, admin, or signer role
    const member = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member) {
      return res.status(403).json({
        error: "Forbidden: You are not a member of this organization",
      });
    }

    if (
      member.role !== "owner" &&
      member.role !== "admin" &&
      member.role !== "signer"
    ) {
      return res.status(403).json({
        error: "Forbidden: You do not have permissions to sign documents",
      });
    }

    // Fetch organization keys
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (
      !organization ||
      !organization.publicKey ||
      !organization.privateKeyEncrypted
    ) {
      return res.status(400).json({
        error:
          "Organization keys not found. Please generate RSA keys in organization settings first.",
      });
    }

    // Download document content to hash and embed QR code
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fetchFileBuffer(fileUrl);
    } catch (err: any) {
      console.error("Error downloading file:", err);
      return res
        .status(400)
        .json({ error: "Failed to download file from UploadThing url." });
    }

    // Generate verification token (UUID)
    const verificationToken = crypto.randomUUID();

    // Construct the verification URL
    const host = req.headers.origin || "http://localhost:5173";
    const verificationUrl = `${host}/verification?token=${verificationToken}`;

    // Embed QR code into the PDF document
    let modifiedPdfBuffer: Buffer;
    try {
      const qrBuffer = await QRCode.toBuffer(verificationUrl, {
        type: "png",
        width: 200,
        margin: 1,
      });

      const pdfDoc = await PDFDocument.load(new Uint8Array(fileBuffer));
      const pages = pdfDoc.getPages();
      if (pages.length === 0) {
        throw new Error("PDF has no pages");
      }

      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBuffer));

      const qrSize = 70;
      const padding = 15;
      const x = width - qrSize - padding;
      const y = padding + 10; // offset a bit for the text

      firstPage.drawImage(qrImage, {
        x,
        y,
        width: qrSize,
        height: qrSize,
      });

      const modifiedPdfBytes = await pdfDoc.save();
      modifiedPdfBuffer = Buffer.from(modifiedPdfBytes);
    } catch (err: any) {
      console.error("Error embedding QR code in PDF:", err);
      return res
        .status(500)
        .json({ error: "Failed to embed QR code in PDF document" });
    }

    // Generate SHA-256 hash of the QR-embedded PDF
    const documentHash = hashDocument(modifiedPdfBuffer);

    // Generate TLSH fuzzy hash for modified version detection
    let fuzzyHash: string | null = null;
    try {
      fuzzyHash = computeTLSH(modifiedPdfBuffer);
    } catch (err) {
      console.warn("Failed to compute TLSH fuzzy hash:", err);
    }

    // Decrypt organization private key
    let privateKeyPem: string;
    try {
      privateKeyPem = decryptPrivateKey(organization.privateKeyEncrypted);
    } catch (err) {
      console.error("Error decrypting private key:", err);
      return res
        .status(500)
        .json({ error: "Failed to decrypt organization private key" });
    }

    // Sign the hash
    const digitalSignature = signHash(documentHash, privateKeyPem);

    // Upload the modified PDF back to UploadThing
    let finalFileUrl = fileUrl;
    let finalFileSize = modifiedPdfBuffer.length;
    try {
      const fileToUpload = new File([modifiedPdfBuffer], originalFilename, {
        type: mimeType,
      });
      const uploadResponse = await utapi.uploadFiles([fileToUpload]);
      const uploaded = uploadResponse[0];
      if (!uploaded || uploaded.error) {
        throw new Error(
          uploaded.error?.message || "Failed to upload signed PDF to storage",
        );
      }
      finalFileUrl = uploaded.data.ufsUrl || (uploaded.data as any).url;
    } catch (err: any) {
      console.error("Error uploading modified PDF to UploadThing:", err);
      return res
        .status(500)
        .json({ error: "Failed to upload signed PDF to storage" });
    }

    // Delete the original uploaded PDF (the one without QR code) from UploadThing to clean up
    try {
      const fileKey = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);
      await utapi.deleteFiles(fileKey);
    } catch (err) {
      console.warn("Failed to delete original PDF from UploadThing:", err);
    }

    // Create document record with updated file URL and hash
    const document = await prisma.signedDocument.create({
      data: {
        title,
        type: type || "Other",
        originalFilename,
        fileUrl: finalFileUrl,
        mimeType,
        fileSize: finalFileSize,
        documentHash,
        fuzzyHash,
        digitalSignature,
        verificationToken,
        organizationId: orgId,
        signedBy: userId,
        status: "ACTIVE",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded and signed successfully",
      document,
    });
  } catch (error: any) {
    console.error("Error in uploadAndSign:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * List all signed documents for the active organization
 * Endpoint: GET /api/documents/list
 */
export async function listDocuments(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orgId = req.session?.activeOrganizationId;
    if (!orgId) {
      return res.status(400).json({ error: "No active organization" });
    }

    // Verify member
    const member = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member) {
      return res.status(403).json({ error: "Forbidden: Not a member" });
    }

    const { search, type, status } = req.query as {
      search?: string;
      type?: any;
      status?: any;
    };

    const whereClause: any = {
      organizationId: orgId,
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { originalFilename: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    const documents = await prisma.signedDocument.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        signer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, documents });
  } catch (error) {
    console.error("Error listing documents:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Revoke an issued document
 * Endpoint: POST /api/documents/revoke
 */
export async function revokeDocument(req: Request, res: Response) {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orgId = req.session?.activeOrganizationId;
    if (!orgId) {
      return res.status(400).json({ error: "No active organization" });
    }

    // Verify user is owner or admin in the organization
    const member = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return res.status(403).json({
        error: "Forbidden: Only owners and admins can revoke documents",
      });
    }

    // Update document status
    const result = await prisma.signedDocument.updateMany({
      where: {
        id: documentId,
        organizationId: orgId,
      },
      data: {
        status: "REVOKED",
      },
    });

    if (result.count === 0) {
      return res
        .status(404)
        .json({ error: "Document not found or not part of this organization" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Document revoked successfully" });
  } catch (error) {
    console.error("Error revoking document:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Public route to verify a document by token (e.g. from QR scan)
 * Endpoint: GET /api/documents/verify/:token
 */
export async function verifyDocumentByToken(req: Request, res: Response) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Find document
    const document = await prisma.signedDocument.findUnique({
      where: { verificationToken: token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            publicKey: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        result: "NOT_FOUND",
        message: "Document not found or token is invalid.",
      });
    }

    // Perform signature verification
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fetchFileBuffer(document.fileUrl);
    } catch (err) {
      await prisma.verificationLog.create({
        data: {
          documentId: document.id,
          verificationType: "QR_SCAN",
          verificationResult: "STORAGE_ERROR",
          ipAddress,
          userAgent,
        },
      });
      return res.status(400).json({
        success: false,
        result: "STORAGE_ERROR",
        message:
          "Document file could not be retrieved from storage. The file may have been deleted or is temporarily unavailable.",
      });
    }

    const currentHash = hashDocument(fileBuffer);
    const hashMatch = currentHash === document.documentHash;

    let signatureValid = false;
    if (document.organization.publicKey) {
      try {
        signatureValid = verifySignature(
          currentHash,
          document.digitalSignature,
          document.organization.publicKey,
        );
      } catch (err) {
        console.error("Signature verification error:", err);
      }
    }

    const verified = hashMatch && signatureValid;
    let resultStatus: "VERIFIED" | "TAMPERED_HASH" | "TAMPERED_SIGNATURE";
    if (verified) {
      resultStatus = "VERIFIED";
    } else if (!hashMatch) {
      resultStatus = "TAMPERED_HASH";
    } else {
      resultStatus = "TAMPERED_SIGNATURE";
    }

    // Get optional logged-in user who verified
    let verifiedByUserId: string | null = null;
    const session = await authClientSession(req);
    if (session) {
      verifiedByUserId = session.user.id;
    }

    // Log the verification attempt
    await prisma.verificationLog.create({
      data: {
        documentId: document.id,
        verificationType: "QR_SCAN",
        verificationResult: resultStatus,
        ipAddress,
        userAgent,
        verifiedByUserId,
      },
    });

    return res.status(200).json({
      success: true,
      verified,
      result: resultStatus,
      documentStatus: document.status,
      document: {
        id: document.id,
        title: document.title,
        type: document.type,
        originalFilename: document.originalFilename,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        createdAt: document.createdAt,
      },
      organization: {
        id: document.organization.id,
        name: document.organization.name,
      },
    });
  } catch (error) {
    console.error("Error in verifyDocumentByToken:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Public route to verify a document by file URL (from uploaded file)
 * Endpoint: POST /api/documents/verify-file
 */
export async function verifyDocumentByFile(req: Request, res: Response) {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl is required in the body" });
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Download uploaded verification file
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fetchFileBuffer(fileUrl);
    } catch (err) {
      return res
        .status(400)
        .json({ error: "Failed to download uploaded file for verification" });
    }

    const fileHash = hashDocument(fileBuffer);

    // Compute fuzzy hash for modified version detection
    let uploadedFuzzyHash: string | null = null;
    try {
      uploadedFuzzyHash = computeTLSH(fileBuffer);
    } catch (err) {
      console.warn("Failed to compute TLSH fuzzy hash for uploaded file:", err);
    }

    // Look up signed document by exact hash
    let document = await prisma.signedDocument.findFirst({
      where: { documentHash: fileHash },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            publicKey: true,
          },
        },
      },
    });

    let resultStatus:
      | "VERIFIED"
      | "TAMPERED_SIGNATURE"
      | "NO_MATCHING_RECORD"
      | "MODIFIED_VERSION";
    let verified = false;
    let matchedDocument = document;

    if (!document) {
      // No exact hash match - try fuzzy matching if we have a fuzzy hash
      if (uploadedFuzzyHash) {
        const candidates = await prisma.signedDocument.findMany({
          where: { fuzzyHash: { not: null } },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                publicKey: true,
              },
            },
          },
        });

        // Find best fuzzy match
        let bestMatch: { document: any; diff: number } | null = null;
        for (const candidate of candidates) {
          if (candidate.fuzzyHash) {
            try {
              const diff = compareTLSH(
                uploadedFuzzyHash,
                candidate.fuzzyHash,
              );
              // TLSH distance: small is good.
              if (
                diff < 60 &&
                (!bestMatch || diff < bestMatch.diff)
              ) {
                bestMatch = { document: candidate, diff };
              }
            } catch (err) {
              console.warn("TLSH compare failed:", err);
            }
          }
        }

        if (bestMatch) {
          document = bestMatch.document;
          matchedDocument = document;
          resultStatus = "MODIFIED_VERSION";
        } else {
          resultStatus = "NO_MATCHING_RECORD";
        }
      } else {
        resultStatus = "NO_MATCHING_RECORD";
      }
    }

    if (document && resultStatus !== "MODIFIED_VERSION") {
      // Verify digital signature for exact match
      let signatureValid = false;
      if (document.organization.publicKey) {
        try {
          signatureValid = verifySignature(
            fileHash,
            document.digitalSignature,
            document.organization.publicKey,
          );
        } catch (err) {
          console.error("Signature verification error:", err);
        }
      }

      verified = signatureValid;
      resultStatus = verified ? "VERIFIED" : "TAMPERED_SIGNATURE";
    }

    // Get optional logged-in user who verified
    let verifiedByUserId: string | null = null;
    const session = await authClientSession(req);
    if (session) {
      verifiedByUserId = session.user.id;
    }

    // Log the verification attempt (only if we found a document)
    if (matchedDocument) {
      await prisma.verificationLog.create({
        data: {
          documentId: matchedDocument.id,
          verificationType: "FILE_UPLOAD",
          verificationResult: resultStatus,
          ipAddress,
          userAgent,
          verifiedByUserId,
        },
      });
    }

    return res.status(200).json({
      success: matchedDocument !== undefined,
      verified,
      result: resultStatus,
      documentStatus: matchedDocument?.status,
      document: matchedDocument
        ? {
            id: matchedDocument.id,
            title: matchedDocument.title,
            type: matchedDocument.type,
            originalFilename: matchedDocument.originalFilename,
            fileUrl: matchedDocument.fileUrl,
            fileSize: matchedDocument.fileSize,
            createdAt: matchedDocument.createdAt,
          }
        : undefined,
      organization: matchedDocument?.organization
        ? {
            id: matchedDocument.organization.id,
            name: matchedDocument.organization.name,
          }
        : undefined,
    });
  } catch (error) {
    console.error("Error in verifyDocumentByFile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Fetch verification logs for active organization
 * Endpoint: GET /api/documents/verification-logs
 */
export async function getVerificationLogs(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orgId = req.session?.activeOrganizationId;
    if (!orgId) {
      return res.status(400).json({ error: "No active organization" });
    }

    // Verify member
    const member = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: userId,
      },
    });

    if (!member) {
      return res.status(403).json({ error: "Forbidden: Not a member" });
    }

    const logs = await prisma.verificationLog.findMany({
      where: {
        document: {
          organizationId: orgId,
        },
      },
      orderBy: { verificationTimestamp: "desc" },
      include: {
        document: {
          select: {
            title: true,
            originalFilename: true,
            type: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error("Error listing verification logs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Helper to fetch session for optional verification logs tracking
async function authClientSession(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return session;
  } catch {
    return null;
  }
}
