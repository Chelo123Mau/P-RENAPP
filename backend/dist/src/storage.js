"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeFile = storeFile;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_s3_1 = require("@aws-sdk/client-s3");
/** Dev: guarda en /uploads y expón como estático.
 *  Prod (Render): usa S3 si STORAGE_DRIVER=s3
 */
const driver = process.env.STORAGE_DRIVER || "local";
const uploadsDir = path_1.default.join(process.cwd(), "uploads");
let s3 = null;
if (driver === "s3") {
    s3 = new client_s3_1.S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT || undefined,
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
            : undefined,
    });
}
async function storeFile(buf, filename, mime) {
    if (driver === "s3" && s3) {
        const key = `uploads/${Date.now()}-${filename}`;
        await s3.send(new client_s3_1.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: buf,
            ContentType: mime,
        }));
        const url = process.env.S3_ENDPOINT
            ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`
            : `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
        return { key, url };
    }
    else {
        if (!fs_1.default.existsSync(uploadsDir))
            fs_1.default.mkdirSync(uploadsDir);
        const key = `${Date.now()}-${filename}`;
        const filePath = path_1.default.join(uploadsDir, key);
        fs_1.default.writeFileSync(filePath, buf);
        const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
        const url = `${base}/uploads/${key}`;
        return { key, url };
    }
}
