"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploader = exports.ensureDir = void 0;
exports.fileMeta = fileMeta;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const ensureDir = (p) => { if (!fs_1.default.existsSync(p))
    fs_1.default.mkdirSync(p, { recursive: true }); };
exports.ensureDir = ensureDir;
const baseDir = path_1.default.join(process.cwd(), 'backend', 'storage', 'uploads');
(0, exports.ensureDir)(baseDir);
const storage = multer_1.default.diskStorage({ destination: (_req, _file, cb) => cb(null, baseDir), filename: (_req, file, cb) => { const stamp = Date.now(); const safe = file.originalname.replace(/[^\w.\-]+/g, '_'); cb(null, `${stamp}__${safe}`); } });
exports.uploader = (0, multer_1.default)({ storage });
function fileMeta(absPath, originalName, mimeType) { const buf = fs_1.default.readFileSync(absPath); const hash = crypto_1.default.createHash('sha256').update(buf).digest('hex').slice(0, 16); const stat = fs_1.default.statSync(absPath); return { id: hash, originalName, storagePath: absPath, size: stat.size, mimeType, hash, createdAt: new Date().toISOString() }; }
