import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import routes from "./routes";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { Router } from "express"

import { requireAuth, requireStaff } from "./middleware/auth";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ===========================================================
// 👇 Diagnóstico de conexión a la base de datos
import dotenv from "dotenv";
dotenv.config();

if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  const masked = dbUrl.replace(/:\/\/(.*)@/, "://***@"); // oculta usuario/pass
  console.log("[RENAPP] Conectado a BD:", masked);
} else {
  console.warn("[RENAPP] ⚠️ No se encontró DATABASE_URL en variables de entorno.");
}
// ===========================================================


// ===== Bootstrap DB en memoria (debe ir ARRIBA) =====
type User = {
  id: string;
  username?: string;
  email?: string;
  role: 'admin' | 'reviewer' | 'user';
  isApproved: boolean;
  profileCompleted?: boolean;
  fullName?: string;
  status?: 'borrador'|'enviado'|'aprobado'|'revision_final'|'observaciones';
  createdAt?: string;
  updatedAt?: string;
  password?: string;
};
type Draft   = { data: any };
type Entity  = { id: string; userId: string; name: string; status: NonNullable<User['status']>; createdAt?: string; updatedAt?: string; data?: any; files?: Array<{name:string;url:string}>; };
type Project = { id: string; userId: string; title: string; status: NonNullable<User['status']>; createdAt?: string; updatedAt?: string; data?: any; files?: Array<{name:string;url:string}>; };

declare global {
  // eslint-disable-next-line no-var
  var RENAPP_DB:
    | { users: Map<string,User>; drafts: Map<string,Draft>; entities: Map<string,Entity>; projects: Map<string,Project> }
    | undefined;
}

export const db =
  (global as any).RENAPP_DB ??
  ((global as any).RENAPP_DB = {
    users:    new Map<string, User>(),
    drafts:   new Map<string, Draft>(),
    entities: new Map<string, Entity>(),
    projects: new Map<string, Project>(),
  });

export function inferUserStatus(u: User): NonNullable<User['status']> {
  if (u.status) return u.status;
  if (u.isApproved) return 'aprobado';
  if (u.profileCompleted) return 'enviado';
  return 'borrador';
}


// ---------------------------
const app = express();
const PORT = Number(process.env.PORT || 4000);
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:5173';
const r = Router();

app.use(cors({
  origin: [
    'http://localhost:5173',
    FRONT_ORIGIN, // en Render: https://renapp-frontend.onrender.com
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(routes);
// ---------------------------
/** DB en memoria (demo) */

type UserDraft = {
  userId: string;
  data: Record<string, any>;
  updatedAt: string;
};

const db = {
  users: new Map<string, User>(),
  drafts: new Map<string, UserDraft>() // key = userId
};

// Crea carpeta de uploads si no 
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------------------------
/** Multer para subida de archivos */
// ---------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}_${id}${ext}`);
  }
});
const uploader = multer({ storage });

function fileMeta(filepath: string, originalname: string, mimetype: string) {
  const st = fs.statSync(filepath);
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

function readAuthHeader(req: Request) {
  const raw = (req.headers?.authorization ?? (req.headers as any)?.Authorization ?? '').toString().trim();
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
}



// Middleware: requiere usuario aprobado
function requireApproved(req: Request & { userId?: string }, res: Response, next: NextFunction) {
  const userId = req.userId!;
  const u = db.users.get(userId);
  if (!u) return res.status(401).json({ error: 'No autorizado' });
  if (!u.isApproved) return res.status(403).json({ error: 'Usuario no aprobado' });
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
  const list = Array.from((db as any).users.values()).map((u: any) => ({
    id: u.id, username: u.username, email: u.email, role: u.role, isApproved: u.isApproved, passIsHash: String(u.password).startsWith('$2')
  }));
  res.json({ count: list.length, users: list });
});

// ====== DEV: echo de lo que llega al login ======
app.post('/api/auth/dev/echo-login', express.json(), (req, res) => {
  res.json({
    received: req.body,
    note: "Comprueba que username/email/identifier y password no vengan vacíos ni con espacios."
  });
});




  
  function requireStaffReview(req: any, res: any, next: any) {
    const u = db.users.get(req.userId);
    if (!u) return res.status(401).json({ error: 'No autorizado' });
    const role = String(u.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'reviewer') {
      return res.status(403).json({ error: 'Sólo revisores/admin' });
    }
    next();
  }

  // --- Utilidades ---
  function filterByStatus<T extends { status: any }>(arr: T[], wanted: string) {
    if (!wanted || wanted === 'all') return arr;
    return arr.filter(x => String(x.status) === wanted);
  }
  function inferUserStatus(u: any): 'borrador'|'enviado'|'aprobado'|'revision_final'|'observaciones' {
    // Si ya le guardaste un "status", respétalo
    if (u?.status) return u.status;
    // Heurística por compatibilidad
    if (u?.isApproved) return 'aprobado';
    if (u?.profileCompleted) return 'enviado';
    return 'borrador';
  }



 
app.post('/api/auth/dev/reset-admin', async (req: Request, res: Response) => {
  try {
    if ((process.env.NODE_ENV || 'development') !== 'development') {
      return res.status(403).json({ error: 'No permitido' });
    }
    const username = (req.body.username || 'admin').trim().toLowerCase();
    const email = (req.body.email || 'admin@renapp.local').trim().toLowerCase();
    const newPass = req.body.password || 'Admin#1234';

    let targetId: string | undefined;
    for (const [id, u] of db.users) {
      const uname = (u.username || '').toLowerCase();
      const mail = (u.email || '').toLowerCase();
      if (uname === username || mail === email) { targetId = id; break; }
    }

    const hash = await bcrypt.hash(newPass, 10);

    if (!targetId) {
      const id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : crypto.randomBytes(16).toString('hex');
      const admin: User = {
        id,
        username,
        email,
        password: hash,
        role: 'admin',
        isApproved: true,
        profileCompleted: true,
        
      };
      db.users.set(id, admin);
      return res.json({ ok: true, created: true, username, email, password: newPass });
    } else {
      const u = db.users.get(targetId)!;
      u.password = hash;
      u.role = 'admin';
      u.isApproved = true;
      u.profileCompleted = true;
      db.users.set(targetId, u);
      return res.json({ ok: true, updated: true, username, email, password: newPass });
    }
  } catch (e) {
    console.error('RESET ADMIN ERROR', e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------------------------
/** Endpoints de registro de usuario (datos completos) */
// ---------------------------

app.get('/api/register/user/draft', requireAuth, (req: Request & { userId?: string }, res: Response) => {
  const draft = db.drafts.get(req.userId!);
  return res.json(draft || { userId: req.userId, data: {}, updatedAt: null });
});

/**
 * POST draft: guarda/actualiza el borrador del usuario autenticado.
 */
app.post('/api/register/user/draft', requireAuth, (req: Request & { userId?: string }, res: Response) => {
  const now = new Date().toISOString();
  const draft: UserDraft = { userId: req.userId!, data: req.body || {}, updatedAt: now };
  db.drafts.set(req.userId!, draft);
  return res.json({ ok: true, draft });
});

/**
 * POST enviar formulario: marca el perfil como "completado" y pendiente de aprobación.
 */
app.post('/api/register/user', requireAuth, (req: Request & { userId?: string }, res: Response) => {
  const u = db.users.get(req.userId!);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  
  u.profileCompleted = true;
  // Aquí NO aprobamos automáticamente, se queda pendiente:
  u.isApproved = u.isApproved || false;

  db.users.set(u.id, u);
  return res.json({ ok: true, status: 'submitted', isApproved: u.isApproved });
});

// ---------------------------
/** Upload de archivos (protegido) */
// ---------------------------
app.post('/api/upload', requireAuth, uploader.array('files', 15), (req: Request, res: Response) => {
  const files = (req as any).files || [];
  const list = files.map((f: any) => fileMeta(f.path, f.originalname, f.mimetype));
  return res.json({ files: list });
});

// ---------------------------
// ---------------------------
/** Salud */
// ---------------------------
app.get('/api/test', (_req, res) => {
  res.json({ ok: true, message: 'Backend RENAPP funcionando 🚀' });
});

/* ===================== REVISOR: PENDIENTES con paginación/filtros ===================== */

type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
function parseIntOr(def: number, v?: string) { const n = parseInt(String(v||""), 10); return Number.isFinite(n) && n > 0 ? n : def; }

/** Normaliza querystring: page, pageSize, status, q, sort */
function readListParams(qs: any) {
  const page = parseIntOr(1, qs.page);
  const pageSize = Math.min(100, parseIntOr(10, qs.pageSize)); // cap 100
  const status = (qs.status ? String(qs.status) : "").toUpperCase(); // ENVIADO | SOLICITUD_MOD_REGISTRO | OBSERVACIONES | APROBADO | BORRADOR | ...
  const q = (qs.q ? String(qs.q) : "").trim(); // búsqueda
  const sort = (qs.sort ? String(qs.sort) : "-createdAt"); // createdAt | -createdAt | title | name | username ...
  return { page, pageSize, status, q, sort };
}

function buildMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Construye orden para Prisma desde 'sort' tipo "-createdAt" o "name" */
function prismaOrder(sort: string) {
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  const dir = desc ? "desc" : "asc";
  const allowed = new Set(["createdAt", "updatedAt", "name", "title", "username", "email", "status"]);
  return allowed.has(key) ? { [key]: dir } as any : { createdAt: "desc" } as any;
}

/** Usuarios pendientes (vienen de User + UserProfile) */
r.get("/api/review/pendientes/users", requireAuth, requireStaff, async (req: any, res) => {
  const { page, pageSize, status, q, sort } = readListParams(req.query);

  // Estados que normalmente revisa el revisor:
  // ENVIADO (primera revisión), SOLICITUD_MOD_REGISTRO (usuario pidió modificar), OBSERVACIONES (devolvió el revisor, usuario reenvía)
  const statusFilter = status
    ? { status: status as any }
    : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] as any } };

  const where: any = {
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
r.get("/api/review/pendientes/entities", requireAuth, requireStaff, async (req: any, res) => {
  const { page, pageSize, status, q, sort } = readListParams(req.query);

  const where: any = status
    ? { status: status as any }
    : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] as any } };

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
r.get("/api/review/pendientes/projects", requireAuth, requireStaff, async (req: any, res) => {
  const { page, pageSize, status, q, sort } = readListParams(req.query);

  const where: any = status
    ? { status: status as any }
    : { status: { in: ["ENVIADO", "SOLICITUD_MOD_REGISTRO", "OBSERVACIONES"] as any } };

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
r.get("/api/review/pendientes/summary", requireAuth, requireStaff, async (_req: any, res) => {
  const [
    uEnviados, uObs, uMod,
    eEnviadas, eObs, eMod,
    pEnviados, pObs, pMod,
  ] = await Promise.all([
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
    entities:{ ENVIADO: eEnviadas, OBSERVACIONES: eObs, SOLICITUD_MOD_REGISTRO: eMod },
    projects:{ ENVIADO: pEnviados, OBSERVACIONES: pObs, SOLICITUD_MOD_REGISTRO: pMod },
  });
});

app.use(r);

// ---------------------------
/** Arranque */
// ---------------------------

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  console.log(`✅ Backend RENAPP escuchando en el puerto ${PORT}`);
  // Si tienes FRONT_ORIGIN:
  if (process.env.FRONT_ORIGIN) {
    console.log(`   Front permitido: ${process.env.FRONT_ORIGIN}`);
  }
});
