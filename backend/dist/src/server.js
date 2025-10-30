"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.inferUserStatus = inferUserStatus;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const routes_1 = __importDefault(require("./routes"));
const express_2 = require("express");
const auth_1 = require("./middleware/auth");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ===========================================================
// 👇 Diagnóstico de conexión a la base de datos
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    const masked = dbUrl.replace(/:\/\/(.*)@/, "://***@"); // oculta usuario/pass
    console.log("[RENAPP] Conectado a BD:", masked);
}
else {
    console.warn("[RENAPP] ⚠️ No se encontró DATABASE_URL en variables de entorno.");
}
exports.db = global.RENAPP_DB ??
    (global.RENAPP_DB = {
        users: new Map(),
        drafts: new Map(),
        entities: new Map(),
        projects: new Map(),
    });
function inferUserStatus(u) {
    if (u.status)
        return u.status;
    if (u.isApproved)
        return 'aprobado';
    if (u.profileCompleted)
        return 'enviado';
    return 'borrador';
}
// ---------------------------
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '15mb' }));
app.use((0, cookie_parser_1.default)());
app.set('trust proxy', 1); // opcional pero recomendado si usas cookies
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || // ← preferente (Render)
    process.env.FRONT_ORIGIN || // ← compatibilidad con tu var actual
    'http://localhost:5173' // ← fallback dev
)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const corsOptions = {
    origin(origin, callback) {
        // Permite requests sin origin (p.ej. curl, healthchecks)
        if (!origin)
            return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true, // pon en false si NO usas cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
};
app.use((0, cors_1.default)(corsOptions));
// MUY IMPORTANTE: responder preflight para todas las rutas
app.options('*', (0, cors_1.default)(corsOptions));
app.get('/health', (_req, res) => res.sendStatus(200));
const PORT = Number(process.env.PORT || 4000);
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:5173';
const r = (0, express_2.Router)();
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        FRONT_ORIGIN, // en Render: https://renapp-frontend.onrender.com
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "uploads")));
app.use(routes_1.default);
const allowed = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({
    origin: allowed.length ? allowed : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options("*", (0, cors_1.default)(corsOptions));
const db = {
    users: new Map(),
    drafts: new Map() // key = userId
};
// Crea carpeta de uploads si no 
const UPLOAD_DIR = path_1.default.resolve(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// ---------------------------
/** Multer para subida de archivos */
// ---------------------------
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const id = crypto_1.default.randomBytes(8).toString('hex');
        const ext = path_1.default.extname(file.originalname) || '';
        cb(null, `${Date.now()}_${id}${ext}`);
    }
});
const uploader = (0, multer_1.default)({ storage });
function fileMeta(filepath, originalname, mimetype) {
    const st = fs_1.default.statSync(filepath);
    return {
        path: filepath,
        name: originalname,
        type: mimetype,
        size: st.size
    };
}
// ---------------------------
/** Helpers de auth */
// ---------------------------
function readAuthHeader(req) {
    const raw = (req.headers?.authorization ?? req.headers?.Authorization ?? '').toString().trim();
    return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
}
// Middleware: requiere usuario aprobado
function requireApproved(req, res, next) {
    const userId = req.userId;
    const u = exports.db.users.get(userId);
    if (!u)
        return res.status(401).json({ error: 'No autorizado' });
    if (!u.isApproved)
        return res.status(403).json({ error: 'Usuario no aprobado' });
    return next();
}
// ---------------------------
/** Endpoints de autenticación */
// ---------------------------
/**
 * Signup básico (solo usuario y contraseña).
 * - Crea user con isApproved=false y devuelve token demo.<id>
 */
/**
 * Login: acepta "username" o "email" o "identifier" en el mismo campo.
 * - Busca por username/email (case-insensitive) y compara bcrypt.
 */
/**
 * Me: devuelve datos básicos para flujos de front (redirigir según isApproved)
 */
// ====== DEV: ver usuarios en memoria ======
app.get('/api/auth/dev/users', (req, res) => {
    if ((process.env.NODE_ENV || 'development') !== 'development') {
        return res.status(403).json({ error: 'No permitido' });
    }
    const list = Array.from(exports.db.users.values()).map((u) => ({
        id: u.id, username: u.username, email: u.email, role: u.role, isApproved: u.isApproved, passIsHash: String(u.password).startsWith('$2')
    }));
    res.json({ count: list.length, users: list });
});
// ====== DEV: echo de lo que llega al login ======
app.post('/api/auth/dev/echo-login', express_1.default.json(), (req, res) => {
    res.json({
        received: req.body,
        note: "Comprueba que username/email/identifier y password no vengan vacíos ni con espacios."
    });
});
function requireStaffReview(req, res, next) {
    const u = exports.db.users.get(req.userId);
    if (!u)
        return res.status(401).json({ error: 'No autorizado' });
    const role = String(u.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'reviewer') {
        return res.status(403).json({ error: 'Sólo revisores/admin' });
    }
    next();
}
// --- Utilidades ---
function filterByStatus(arr, wanted) {
    if (!wanted || wanted === 'all')
        return arr;
    return arr.filter(x => String(x.status) === wanted);
}
function inferUserStatus(u) {
    // Si ya le guardaste un "status", respétalo
    if (u?.status)
        return u.status;
    // Heurística por compatibilidad
    if (u?.isApproved)
        return 'aprobado';
    if (u?.profileCompleted)
        return 'enviado';
    return 'borrador';
}
app.post('/api/auth/dev/reset-admin', async (req, res) => {
    try {
        if ((process.env.NODE_ENV || 'development') !== 'development') {
            return res.status(403).json({ error: 'No permitido' });
        }
        const username = (req.body.username || 'admin').trim().toLowerCase();
        const email = (req.body.email || 'admin@renapp.local').trim().toLowerCase();
        const newPass = req.body.password || 'Admin#1234';
        let targetId;
        for (const [id, u] of exports.db.users) {
            const uname = (u.username || '').toLowerCase();
            const mail = (u.email || '').toLowerCase();
            if (uname === username || mail === email) {
                targetId = id;
                break;
            }
        }
        const hash = await bcryptjs_1.default.hash(newPass, 10);
        if (!targetId) {
            const id = crypto_1.default.randomUUID ? crypto_1.default.randomUUID() : crypto_1.default.randomBytes(16).toString('hex');
            const admin = {
                id,
                username,
                email,
                password: hash,
                role: 'admin',
                isApproved: true,
                profileCompleted: true,
            };
            exports.db.users.set(id, admin);
            return res.json({ ok: true, created: true, username, email, password: newPass });
        }
        else {
            const u = exports.db.users.get(targetId);
            u.password = hash;
            u.role = 'admin';
            u.isApproved = true;
            u.profileCompleted = true;
            exports.db.users.set(targetId, u);
            return res.json({ ok: true, updated: true, username, email, password: newPass });
        }
    }
    catch (e) {
        console.error('RESET ADMIN ERROR', e);
        return res.status(500).json({ error: 'Error del servidor' });
    }
});
// ---------------------------
/** Endpoints de registro de usuario (datos completos) */
// ---------------------------
app.get('/api/register/user/draft', auth_1.requireAuth, (req, res) => {
    const draft = exports.db.drafts.get(req.userId);
    return res.json(draft || { userId: req.userId, data: {}, updatedAt: null });
});
/**
 * POST draft: guarda/actualiza el borrador del usuario autenticado.
 */
app.post('/api/register/user/draft', auth_1.requireAuth, (req, res) => {
    const now = new Date().toISOString();
    const draft = { userId: req.userId, data: req.body || {}, updatedAt: now };
    exports.db.drafts.set(req.userId, draft);
    return res.json({ ok: true, draft });
});
/**
 * POST enviar formulario: marca el perfil como "completado" y pendiente de aprobación.
 */
app.post('/api/register/user', auth_1.requireAuth, (req, res) => {
    const u = exports.db.users.get(req.userId);
    if (!u)
        return res.status(404).json({ error: 'Usuario no encontrado' });
    u.profileCompleted = true;
    // Aquí NO aprobamos automáticamente, se queda pendiente:
    u.isApproved = u.isApproved || false;
    exports.db.users.set(u.id, u);
    return res.json({ ok: true, status: 'submitted', isApproved: u.isApproved });
});
// ---------------------------
/** Upload de archivos (protegido) */
// ---------------------------
app.post("/api/upload", auth_1.requireAuth, uploader.array("files", 15), async (req, res) => {
    try {
        const userId = req.user?.id; // ← lo pone requireAuth
        const { fieldKey, draftKey } = req.body;
        if (!draftKey) {
            return res.status(400).json({ ok: false, error: "draftKey requerido" });
        }
        const files = req.files || [];
        // Si usas almacenamiento local, probablemente 'path' sea tu URL pública;
        // si usas S3/Render, pon aquí tu builder de URL pública.
        const toPublicUrl = (f) => f.path;
        const created = [];
        for (const f of files) {
            // Guarda cada archivo en la BD con el "puente" draftKey + quién lo subió
            const row = await prisma.file.create({
                data: {
                    fieldKey: fieldKey || null,
                    draftKey, // puente temporal
                    createdByUserId: userId || null,
                    originalName: f.originalname,
                    mime: f.mimetype,
                    size: f.size,
                    url: toPublicUrl(f), // ajusta si necesitas tu URL pública
                    // NO setees entityId aquí; todavía no existe la entidad
                },
                select: {
                    id: true,
                    url: true,
                    mime: true,
                    size: true,
                    fieldKey: true,
                    draftKey: true,
                    entityId: true,
                    entityName: true,
                    originalName: true,
                },
            });
            created.push(row);
        }
        return res.json({ ok: true, files: created });
    }
    catch (err) {
        console.error("upload error:", err);
        return res.status(500).json({ ok: false, error: "No se pudo subir" });
    }
});
// ---------------------------
// ---------------------------
/** Salud */
// ---------------------------
app.get('/api/test', (_req, res) => {
    res.json({ ok: true, message: 'Backend RENAPP funcionando 🚀' });
});
function parseIntOr(def, v) { const n = parseInt(String(v || ""), 10); return Number.isFinite(n) && n > 0 ? n : def; }
/** Normaliza querystring: page, pageSize, status, q, sort */
function readListParams(qs) {
    const page = parseIntOr(1, qs.page);
    const pageSize = Math.min(100, parseIntOr(10, qs.pageSize)); // cap 100
    const status = (qs.status ? String(qs.status) : "").toUpperCase(); // ENVIADO | SOLICITUD_MOD_REGISTRO | OBSERVACIONES | APROBADO | BORRADOR | ...
    const q = (qs.q ? String(qs.q) : "").trim(); // búsqueda
    const sort = (qs.sort ? String(qs.sort) : "-createdAt"); // createdAt | -createdAt | title | name | username ...
    return { page, pageSize, status, q, sort };
}
function buildMeta(page, pageSize, total) {
    return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
/** Construye orden para Prisma desde 'sort' tipo "-createdAt" o "name" */
function prismaOrder(sort) {
    const desc = sort.startsWith("-");
    const key = desc ? sort.slice(1) : sort;
    const dir = desc ? "desc" : "asc";
    const allowed = new Set(["createdAt", "updatedAt", "name", "title", "username", "email", "status"]);
    return allowed.has(key) ? { [key]: dir } : { createdAt: "desc" };
}
/** Usuarios pendientes (vienen de User + UserProfile) */
r.get("/api/review/pendientes/users", auth_1.requireAuth, auth_1.requireStaff, async (req, res) => {
    const { page, pageSize, status, q, sort } = readListParams(req.query);
    // Estados que normalmente revisa el revisor:
    // ENVIADO (primera revisión), SOLICITUD_MOD_REGISTRO (usuario pidió modificar), OBSERVACIONES (devolvió el revisor, usuario reenvía)
    const statusFilter = status
        ? { status: status }
        : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] } };
    const where = {
        profile: statusFilter,
    };
    if (q) {
        // búsqueda por username, email 
        where.OR = [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
        ];
    }
    const orderBy = prismaOrder(sort);
    const [total, rows] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            include: { profile: true },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);
    // Devuelve shape amigable para el front de revisión
    const items = rows.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        status: u.profile?.status || (u.isApproved ? "APROBADO" : u.profileCompleted ? "ENVIADO" : "BORRADOR"),
        data: u.profile?.data || {},
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    }));
    res.json({ items, meta: buildMeta(page, pageSize, total) });
});
/** Entidades pendientes */
r.get("/api/review/pendientes/entities", auth_1.requireAuth, auth_1.requireStaff, async (req, res) => {
    const { page, pageSize, status, q, sort } = readListParams(req.query);
    const where = status
        ? { status: status }
        : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] } };
    if (q) {
        // búsqueda por nombre de entidad, NIT, representante, correo
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { nit: { contains: q, mode: "insensitive" } },
            { representanteLegal: { contains: q, mode: "insensitive" } },
            { correo: { contains: q, mode: "insensitive" } },
        ];
    }
    const orderBy = prismaOrder(sort);
    const [total, rows] = await Promise.all([
        prisma.entity.count({ where }),
        prisma.entity.findMany({
            where,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);
    const items = rows.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        nit: e.nit,
        telefono: e.telefono,
        correo: e.correo,
        representanteLegal: e.representanteLegal,
        data: e.data || {},
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
    }));
    res.json({ items, meta: buildMeta(page, pageSize, total) });
});
/** Proyectos pendientes */
r.get("/api/review/pendientes/projects", auth_1.requireAuth, auth_1.requireStaff, async (req, res) => {
    const { page, pageSize, status, q, sort } = readListParams(req.query);
    const where = status
        ? { status: status }
        : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] } };
    if (q) {
        // búsqueda por título, titularMedida, representante, modelo, área
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { titularMedida: { contains: q, mode: "insensitive" } },
            { representanteLegal: { contains: q, mode: "insensitive" } },
            { modeloMercado: { contains: q, mode: "insensitive" } },
            { areaProyecto: { contains: q, mode: "insensitive" } },
        ];
    }
    const orderBy = prismaOrder(sort);
    const [total, rows] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
            where,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);
    const items = rows.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        titularMedida: p.titularMedida,
        representanteLegal: p.representanteLegal,
        modeloMercado: p.modeloMercado,
        areaProyecto: p.areaProyecto,
        data: p.data || {},
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    }));
    res.json({ items, meta: buildMeta(page, pageSize, total) });
});
/** Resumen rápido para dashboard del revisor */
r.get("/api/review/pendientes/summary", auth_1.requireAuth, auth_1.requireStaff, async (_req, res) => {
    const [uEnviados, uObs, uMod, eEnviadas, eObs, eMod, pEnviados, pObs, pMod,] = await Promise.all([
        prisma.userProfile.count({ where: { status: "ENVIADO" } }),
        prisma.userProfile.count({ where: { status: "OBSERVACIONES" } }),
        prisma.userProfile.count({ where: { status: "SOLICITUD_MOD_REGISTRO" } }),
        prisma.entity.count({ where: { status: "ENVIADO" } }),
        prisma.entity.count({ where: { status: "OBSERVACIONES" } }),
        prisma.entity.count({ where: { status: "SOLICITUD_MOD_REGISTRO" } }),
        prisma.project.count({ where: { status: "ENVIADO" } }),
        prisma.project.count({ where: { status: "OBSERVACIONES" } }),
        prisma.project.count({ where: { status: "SOLICITUD_MOD_REGISTRO" } }),
    ]);
    res.json({
        users: { ENVIADO: uEnviados, OBSERVACIONES: uObs, SOLICITUD_MOD_REGISTRO: uMod },
        entities: { ENVIADO: eEnviadas, OBSERVACIONES: eObs, SOLICITUD_MOD_REGISTRO: eMod },
        projects: { ENVIADO: pEnviados, OBSERVACIONES: pObs, SOLICITUD_MOD_REGISTRO: pMod },
    });
});
app.use(r);
// ---------------------------
/** Arranque */
// ---------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
    console.log(`✅ Backend RENAPP escuchando en el puerto ${PORT}`);
    // Si tienes FRONT_ORIGIN:
    if (process.env.FRONT_ORIGIN) {
        console.log(`   Front permitido: ${process.env.FRONT_ORIGIN}`);
    }
});
