import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { emitWorkflowEvent } from "@/lib/workflow/workflow-events";
import { WorkflowEvent } from "@/lib/workflow/workflow-constants";
import { generateWorkflowTasksForPackage } from "@/lib/workflow/workflow-task-engine";
import {
  ALLOWED_EVIDENCE_TYPES,
  EVIDENCE_MAX_BYTES,
  getEvidenceBucket,
  getEvidenceS3Client,
  sanitizeFilename,
} from "@/lib/storage/evidence-storage";

import {
  createVendorEvidenceUpload,
  findRemediationPackageForEvidenceRequest,
  findVendorEvidenceRequest,
  fulfillVendorEvidenceRequest,
} from "@/lib/repositories/vendor-evidence-upload-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEvidenceKind(value: string) {
  switch ((value || "").toUpperCase()) {
    case "POLICY":
      return "POLICY";
    case "REPORT":
    case "SOC2":
    case "ISO27001":
    case "PEN_TEST":
    case "PENTEST":
    case "BCP_DRP":
    case "DPIA":
      return "REPORT";
    case "SCREENSHOT":
      return "SCREENSHOT";
    case "CERTIFICATE":
      return "CERTIFICATE";
    default:
      return "OTHER";
  }
}

function buildVendorEvidenceKey(input: {
  vendorId: number;
  evidenceRequestId: number;
  filename: string;
}) {
  return `truvern/vendor-evidence/${input.vendorId}/requests/${input.evidenceRequestId}/${Date.now()}-${sanitizeFilename(input.filename)}`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const vendorId = Number(form.get("vendorId"));
    const evidenceRequestId = Number(form.get("evidenceRequestId"));
    const note = safeText(form.get("note"));
    const file = form.get("file");

    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return NextResponse.json({ ok: false, error: "Vendor id is required." }, { status: 400 });
    }

    if (!Number.isFinite(evidenceRequestId) || evidenceRequestId <= 0) {
      return NextResponse.json({ ok: false, error: "Evidence request id is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Evidence file is required." }, { status: 400 });
    }

    const evidenceRequest = await findVendorEvidenceRequest({
      evidenceRequestId,
      vendorId,
    });

    if (!evidenceRequest) {
      return NextResponse.json({ ok: false, error: "Evidence request not found." }, { status: 404 });
    }

    const fileName = safeText(file.name) || evidenceRequest.title || "uploaded-evidence";
    const title = note || fileName || evidenceRequest.title || "Uploaded evidence";
    const contentType = safeText(file.type) || "application/octet-stream";
    const sizeBytes = Number(file.size ?? 0);

    if (!ALLOWED_EVIDENCE_TYPES.has(contentType)) {
      return NextResponse.json({ ok: false, error: "Unsupported evidence content type." }, { status: 400 });
    }

    if (sizeBytes > EVIDENCE_MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Evidence file is too large. Maximum size is 25MB." }, { status: 400 });
    }

    const kind = normalizeEvidenceKind(safeText(evidenceRequest.kind));
    const evidenceKey = buildVendorEvidenceKey({ vendorId, evidenceRequestId, filename: fileName });

    const fileBytes = Buffer.from(await file.arrayBuffer());

    let storedUrl = evidenceKey;

    if (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET) {
      await getEvidenceS3Client().send(
        new PutObjectCommand({
          Bucket: getEvidenceBucket(),
          Key: evidenceKey,
          Body: fileBytes,
          ContentType: contentType,
          Metadata: {
            vendorId: String(vendorId),
            evidenceRequestId: String(evidenceRequestId),
            classification: "vendor-evidence",
            product: "truvern",
          },
        }),
      );

      storedUrl = evidenceKey;
    } else {
      const localRoot = path.join(process.cwd(), "public", "uploads", "vendor-evidence");
      const localDir = path.join(localRoot, String(vendorId), "requests", String(evidenceRequestId));
      const safeName = sanitizeFilename(fileName);
      const localFileName = `${Date.now()}-${safeName}`;
      const localPath = path.join(localDir, localFileName);

      await mkdir(localDir, { recursive: true });
      await writeFile(localPath, fileBytes);

      storedUrl = `/uploads/vendor-evidence/${vendorId}/requests/${evidenceRequestId}/${localFileName}`;
    }

    const evidence = await createVendorEvidenceUpload({
      vendorId,
      organizationId: Number(evidenceRequest.organizationId),
      kind,
      title,
      notes: note || `Uploaded file: ${fileName}`,
      storedUrl,
      evidenceRequestId,
    });

    const evidenceId = evidence.id;

    if (!evidenceId) {
      return NextResponse.json({ ok: false, error: "Evidence was not created." }, { status: 500 });
    }

    await fulfillVendorEvidenceRequest({
      evidenceRequestId,
      evidenceId,
    });
    const remediationPackage =
      await findRemediationPackageForEvidenceRequest({
        evidenceRequestId,
      });

    const remediationPackageId =
      remediationPackage?.id ?? null;

    if (remediationPackageId) {
      await emitWorkflowEvent({
        event: WorkflowEvent.EvidenceUploaded,
        packageId: remediationPackageId,
        actor: "VENDOR",
        summary: "Vendor uploaded remediation evidence.",
        payload: {
          evidenceId,
          evidenceRequestId,
          filename: fileName,
          storageKey: storedUrl,
          uploadedBy: "Vendor",
        },
      });

      try {
        await generateWorkflowTasksForPackage({
          packageId: remediationPackageId,
          actor: "VENDOR_UPLOAD_AUTOMATION",
        });
      } catch (taskError) {
        console.warn("Workflow task generation after vendor upload failed:", taskError);
      }
    }

    return NextResponse.json({
      ok: true,
      evidenceId,
      evidenceRequestId,
      status: "SUBMITTED",
      storageKey: storedUrl,
      message: "Evidence uploaded and request submitted for review.",
    });
  } catch (error: any) {
    console.error("Vendor evidence upload failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: safeText(error?.message) || "Failed to upload evidence.",
      },
      { status: 500 },
    );
  }
}




