import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string, fallback?: string) {
  const value = process.env[name] || (fallback ? process.env[fallback] : null);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function storageConfig() {
  const region = process.env.AWS_REGION || "ap-south-1";
  const endpoint = process.env.AWS_S3_ENDPOINT;
  return {
    bucket: required("AWS_S3_BUCKET", "AWS_PUBLIC_BUCKET_NAME"),
    prefix: (process.env.KASA_DOCUMENTS_S3_PREFIX || "kasa").replace(
      /^\/+|\/+$/g,
      "",
    ),
    client: new S3Client({
      region,
      endpoint,
      forcePathStyle:
        process.env.AWS_S3_FORCE_PATH_STYLE === "true" || Boolean(endpoint),
      credentials: {
        accessKeyId: required("AWS_ACCESS_KEY_ID"),
        secretAccessKey: required(
          "AWS_SECRET_ACCESS_KEY",
          "AWS_ACCESS_KEY_SECRET",
        ),
      },
    }),
  };
}

function extension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] ?? "";
}

export function attachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType === "application/pdf") return "PDF";
  return "DOCUMENT";
}

export async function storeAutomationAttachment(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const config = storageConfig();
  const key = `${config.prefix}/lifeos-attachments/${input.userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension(input.fileName)}`;
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.mimeType,
      ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
      ServerSideEncryption: "AES256",
      Metadata: { owner: input.userId, source: "kasa-lifeos" },
    }),
  );
  return key;
}

export async function signedAttachmentUrl(objectKey: string) {
  const config = storageConfig();
  return getSignedUrl(
    config.client,
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: 15 * 60 },
  );
}

export async function storeProfileAvatar(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const config = storageConfig();
  const key = `${config.prefix}/lifeos-profile-images/${input.userId}/${randomUUID()}${extension(input.fileName) || ".jpg"}`;
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.mimeType,
      ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
      ServerSideEncryption: "AES256",
      Metadata: { owner: input.userId, source: "kasa-profile-avatar" },
    }),
  );
  return key;
}

export async function signedProfileAvatarUrl(objectKey: string) {
  const config = storageConfig();
  return getSignedUrl(
    config.client,
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: 60 * 60 },
  );
}

/*
 * Life Vault documents are stored under their own prefix, separate from
 * automation attachments, so retention and access policies can differ: vault
 * files are user-owned records kept indefinitely, attachments are byproducts of
 * ingestion.
 */
export async function storeVaultDocument(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const config = storageConfig();
  const key = `${config.prefix}/lifeos-documents/${input.userId}/${randomUUID()}${extension(input.fileName)}`;
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.mimeType,
      ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
      ServerSideEncryption: "AES256",
      Metadata: { owner: input.userId, source: "kasa-life-vault" },
    }),
  );
  return key;
}

/*
 * Short-lived URL for viewing a document inline.
 *
 * The TTL is deliberately brief: these are identity documents, and a signed URL
 * is a bearer credential that works for anyone holding it. Five minutes is long
 * enough to open and read a file, short enough that a leaked link from browser
 * history or a shared screenshot is not durable access.
 */
export async function signedDocumentViewUrl(objectKey: string) {
  const config = storageConfig();
  return getSignedUrl(
    config.client,
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: 5 * 60 },
  );
}

/*
 * Signed URL that prompts a download rather than rendering inline.
 * ResponseContentDisposition overrides the stored header per request, so the
 * same object serves both view and download without a second copy.
 */
export async function signedDocumentDownloadUrl(
  objectKey: string,
  fileName: string,
) {
  const config = storageConfig();
  return getSignedUrl(
    config.client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: 5 * 60 },
  );
}

/*
 * Best-effort delete. Callers remove the database row first: an orphaned S3
 * object is recoverable waste, whereas a row pointing at a deleted object is a
 * broken document in the user's vault.
 */
export async function deleteVaultDocument(objectKey: string) {
  const config = storageConfig();
  await config.client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }),
  );
}
