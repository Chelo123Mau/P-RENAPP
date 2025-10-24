import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/** Dev: guarda en /uploads y expón como estático.
 *  Prod (Render): usa S3 si STORAGE_DRIVER=s3
 */
const driver = process.env.STORAGE_DRIVER || "local";
const uploadsDir = path.join(process.cwd(), "uploads");

let s3: S3Client | null = null;
if (driver === "s3") {
  s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
}

export async function storeFile(buf: Buffer, filename: string, mime: string): Promise<{ key: string; url: string; }> {
  if (driver === "s3" && s3) {
    const key = `uploads/${Date.now()}-${filename}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buf,
      ContentType: mime,
    }));
    const url = process.env.S3_ENDPOINT
      ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`
      : `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
    return { key, url };
  } else {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    const key = `${Date.now()}-${filename}`;
    const filePath = path.join(uploadsDir, key);
    fs.writeFileSync(filePath, buf);
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const url = `${base}/uploads/${key}`;
    return { key, url };
  }
}
