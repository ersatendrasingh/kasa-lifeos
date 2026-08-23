import { randomUUID } from "node:crypto";

import {
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
