import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";
import { requireAuth, requireStaff } from "./middleware/auth";
import { storeFile } from "./storage";

const r = Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ===================== AUTH ===================== */
r.post("/api/auth/login", async (req, res) => {
  const { username, email, identifier, password } = req.body || {};
  const ident = String(identifier || username || email || "").trim();
  if (!ident || !password) return res.status(400).json({ error: "Faltan credenciales" });

  const u = await prisma.user.findFirst({ where: { OR: [{ username: ident }, { email: ident }] } });
  if (!u) return res.status(400).json({ error: "Usuario o contraseña inválidos" });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(400).json({ error: "Usuario o contraseña inválidos" });

  const token = jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET || "dev", { expiresIn: "7d" });
  res.json({ token });
});

// ===================== AUTH: SIGNUP =====================
r.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const uName = String(username).trim().toLowerCase();
    const uMail = String(email).trim().toLowerCase();

    const exists = await prisma.user.findFirst({
      where: { OR: [{ username: uName }, { email: uMail }] },
      select: { id: true },
    });
    if (exists) return res.status(409).json({ error: "Usuario o email ya existe" });

    const hash = await bcrypt.hash(password, 10);

    const u = await prisma.user.create({
      data: {
        username: uName,
        email: uMail,
        passwordHash: hash,
        role: "USER",
        isApproved: false,
        profileCompleted: false,
      },
      select: { id: true, username: true, email: true },
    });

    return res.json({ ok: true, id: u.id, username: u.username, email: u.email });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "Error en el servidor" });
  }
});


r.get("/api/auth/me", requireAuth, async (req: any, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!me) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({
    id: me.id, username: me.username, email: me.email,
    role: me.role.toLowerCase(), isApproved: me.isApproved, profileCompleted: me.profileCompleted, fullName: me.fullName
  });
});

/* ============ REGISTER USER (draft/submit/request-change) ============ */
r.get("/api/register/user", requireAuth, async (req: any, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, include: { profile: true } });
  if (!u) return res.status(404).json({ error: "No encontrado" });
  const status = u.isApproved ? "aprobado" : (u.profile?.status?.toLowerCase() || (u.profileCompleted ? "enviado" : "borrador"));
  const data = u.profile?.data || {};
  // agrega algunos campos básicos que también guardamos normalizados
  res.json({phone: u.profile?.phone, address: u.profile?.address, status });
});

r.get("/api/register/user/draft", requireAuth, async (req: any, res) => {
  const d = await prisma.draft.findUnique({ where: { userId: req.userId } });
  res.json(d ? { data: d.data } : {});
});

r.post("/api/register/user/draft", requireAuth, async (req: any, res) => {
  const data = req.body?.data ?? {};
  const ex = await prisma.draft.findUnique({ where: { userId: req.userId } });
  const draft = ex
    ? await prisma.draft.update({ where: { userId: req.userId }, data: { data } })
    : await prisma.draft.create({ data: { userId: req.userId, data } });
  res.json({ ok: true, id: draft.id });
});

r.post("/api/register/user/submit", requireAuth, async (req: any, res) => {
  // 1) Tomar el último borrador (o data enviada en body si prefieres)
  const draft = await prisma.draft.findUnique({ where: { userId: req.userId } });
  const d = (draft?.data as any) || {};

  // 2) Mapeo a columnas normalizadas
  const payload = {
    nombres:         d.nombres ?? null,
    apellidos:       d.apellidos ?? null,
    tipoDocumento:   d.tipoDocumento ?? "CI",
    nroDocumento:    d.nroDocumento ?? d.ci ?? null,
    pais:            d.pais ?? "Bolivia",
    departamento:    d.departamento ?? null,
    ciudad:          d.ciudad ?? null,
    direccion:       d.direccion ?? d.domicilio ?? null,
    institucion:     d.institucion ?? d.entidadRepresenta ?? null,
    cargo:           d.cargo ?? d.cargoRelacion ?? null,
    telefono:        d.telefono ?? null,
    fechaNacimiento: d.fechaNacimiento ?? null,
  };

  // 3) Marcar user como completado
  await prisma.user.update({
    where: { id: req.userId },
    data: { profileCompleted: true }
  });

  // 4) Upsert del perfil: columnas + JSON completo
  await prisma.userProfile.upsert({
    where: { userId: req.userId },
    create: {
      userId: req.userId,
      ...payload,
      data: d,
      status: "ENVIADO",
    },
    update: {
      ...payload,
      data: d,
      status: "ENVIADO",
    },
  });

    res.json({ ok: true });
});
/* =========================================================
PANEL: LISTA DE USUARIOS (SIN HISTORIAL)
   - Devuelve usuarios en filas (uno por fila)
   - SIN filtro por rol temporalmente (ver comentario)*/

r.get("/api/review/users", requireAuth, requireStaff, async (req: any, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize || "20", 10)));
  const q = String(req.query.q || "").trim();

  // ⚠️ SIN FILTRO por rol mientras depuras.
  // Cuando soluciones, usa: const where: any = { role: "USER" };
  const where: any = {role: "USER"};

  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { entity: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const mapped = items.map(u => ({
    id: u.id,
    username: u.username ?? null,
    email: u.email ?? null,
    isApproved: u.isApproved ?? false,
    entityId: u.entity?.id ?? null,
    entityName: u.entity?.name ?? null,
    role: u.role ?? null,
  }));

  return res.json({ ok: true, data: { items: mapped, meta: { page, pageSize, total } } });
});

/* =========================================================
   PERFIL DE USUARIO (UserProfile)
   - Devuelve campos del user profile + email y estado simple
========================================================= */

r.get("/api/users/:id/profile", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { email: true, isApproved: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: id },
      // si no existe, devolvemos nulls sin romper
    }),
  ]);

  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  return res.json({
    email: user.email,
    status: profile?.status || (user.isApproved ? "APROBADO" : undefined),
    nombres: profile?.nombres ?? null,
    apellidos: profile?.apellidos ?? null,
    tipoDocumento: profile?.tipoDocumento ?? null,
    nroDocumento: profile?.nroDocumento ?? null,
    pais: profile?.pais ?? null,
    departamento: profile?.departamento ?? null,
    ciudad: profile?.ciudad ?? null,
    direccion: profile?.direccion ?? null,
    institucion: profile?.institucion ?? null,
    cargo: profile?.cargo ?? null,
    telefono: profile?.telefono ?? null,
    fechaNacimiento: profile?.fechaNacimiento ?? null,
    data: profile?.data ?? null,
  });
});

/* =========================================================
   DOCUMENTOS DEL USUARIO
========================================================= */
r.get("/api/users/:id/documents", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  const files = await prisma.file.findMany({
    where: { userId: id },
    select: { id: true, name: true, url: true, mime: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ ok: true, data: { items: files } });
});

/* =========================================================
   REVISOR: APROBAR / OBSERVAR USUARIO
   - SIN historial
========================================================= */
r.post("/api/review/users/:id/approve", requireAuth, requireStaff, async (req: any, res) => {
  const userId = req.params.id;

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true, profileCompleted: true },
  });

  return res.json({ ok: true });
});

r.post("/api/review/users/:id/observe", requireAuth, requireStaff, async (req: any, res) => {
  const userId = req.params.id;
  const { comments } = req.body || {};

  // Puedes guardar "comments" en otra tabla si tienes una definida; aquí solo marcamos el estado.
  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: false, profileCompleted: true },
  });

  return res.json({ ok: true });
});

/* =========================================================
   REVISOR: APROBAR / OBSERVAR ENTIDAD
   - Ajusta status según tu enum/string de Prisma (APROBADO/OBSERVACIONES)
   - SIN historial
========================================================= */
r.post("/api/review/entities/:id/approve", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  await prisma.entity.update({
    where: { id },
    data: { status: "APROBADO" },
  });

  return res.json({ ok: true });
});

r.post("/api/review/entities/:id/observe", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;
  const { comments } = req.body || {};

  await prisma.entity.update({
    where: { id },
    data: { status: "OBSERVACIONES" },
  });

  return res.json({ ok: true });
});

/* =========================================================
   REVISOR: APROBAR / OBSERVAR PROYECTO
   - Ajusta status según tu enum/string de Prisma
   - SIN historial
========================================================= */
r.post("/api/review/projects/:id/approve", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  await prisma.project.update({
    where: { id },
    data: { status: "APROBADO" },
  });

  return res.json({ ok: true });
});

r.post("/api/review/projects/:id/observe", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;
  const { comments } = req.body || {};

  await prisma.project.update({
    where: { id },
    data: { status: "OBSERVACIONES" },
  });

  return res.json({ ok: true });
});


/* ============================ ENTIDADES ============================ */
r.get("/api/entities/mine", requireAuth, async (req: any, res) => {
  const items = await prisma.entity.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
  res.json(items);
});

r.post("/api/entities/draft", requireAuth, async (req: any, res) => {
  await prisma.historyEntry.create({
    data: { userId: req.userId, scope: "entity", action: "draft-save", title: "Borrador entidad", snapshot: req.body?.data || {} },
  });
  res.json({ ok: true });
});

r.post("/api/entities", requireAuth, async (req: any, res) => {
  const hasOne = await prisma.entity.findFirst({ where: { userId: req.userId } });
  if (hasOne) return res.status(400).json({ error: "Ya existe una entidad para este usuario" });

  const { name, data } = req.body || {};
  // Mapeo a columnas normalizadas
  const telefono = data?.telefono ?? data?.phone ?? null;
  const correo = data?.correo ?? null;
  const web = data?.web ?? null;
  const direccion = data?.direccion ?? null;
  const tipoEntidad = data?.tipoEntidad ?? null;
  const fechaConstitucion = data?.fechaConstitucion ?? null;
  const municipioConstitucion = data?.municipioConstitucion ?? null;
  const representanteLegal = data?.representanteLegal ?? null;
  const numeroComercial = data?.numeroComercial ?? null;
  const nit = data?.nit ?? null;
  const nacionalOExtranjera = data?.nacionalOExtranjera ?? null;

  const e = await prisma.entity.create({
    data: {
      userId: req.userId,
      name,
      data,
      status: "ENVIADO",
      telefono, correo, web, direccion, tipoEntidad, fechaConstitucion, municipioConstitucion,
      representanteLegal, numeroComercial, nit, nacionalOExtranjera
    }
  });
  await prisma.historyEntry.create({ data: { userId: req.userId, scope: "entity", action: "submit", title: "Envío entidad", snapshot: data, status: "ENVIADO" } });
  res.json(e);
});

r.post("/api/entities/:id/request-change", requireAuth, async (req: any, res) => {
  const id = req.params.id;
  const e = await prisma.entity.findFirst({ where: { id, userId: req.userId } });
  if (!e) return res.status(404).json({ error: "No encontrado" });
  await prisma.historyEntry.create({ data: { userId: req.userId, scope: "entity", action: "request-change", title: "Solicitud modificación entidad", snapshot: e.data } });
  res.json({ ok: true });
});

/* ============================ PROYECTOS ============================ */
r.get("/api/projects/mine", requireAuth, async (req: any, res) => {
  const items = await prisma.project.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
  res.json(items);
});

r.post("/api/projects/draft", requireAuth, async (req: any, res) => {
  await prisma.historyEntry.create({
    data: { userId: req.userId, scope: "project", action: "draft-save", title: "Borrador proyecto", snapshot: req.body?.data || {} },
  });
  res.json({ ok: true });
});

r.post("/api/projects", requireAuth, async (req: any, res) => {
  const ent = await prisma.entity.findFirst({ where: { userId: req.userId } });
  if (!ent) return res.status(400).json({ error: "Primero registre una entidad" });
  const { title, summary, data } = req.body || {};

  const titularMedida = data?.titularMedida ?? null;
  const representanteLegal = data?.representanteLegal ?? null;
  const numeroIdentidad = data?.numeroIdentidad ?? null;
  const numeroDocNotariado = data?.numeroDocNotariado ?? null;
  const modeloMercado = data?.modeloMercado ?? summary ?? null;
  const areaProyecto = data?.areaProyecto ?? null;

  const p = await prisma.project.create({
    data: {
      userId: req.userId,
      entityId: ent.id,
      title,
      status: "ENVIADO",
      data,
      titularMedida, representanteLegal, numeroIdentidad, numeroDocNotariado, modeloMercado, areaProyecto
    }
  });
  await prisma.historyEntry.create({ data: { userId: req.userId, scope: "project", action: "submit", title: `Envío proyecto: ${title}`, snapshot: data, status: "ENVIADO" } });
  res.json(p);
});

r.post("/api/projects/:id/request-change", requireAuth, async (req: any, res) => {
  const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!p) return res.status(404).json({ error: "No encontrado" });
  await prisma.historyEntry.create({ data: { userId: req.userId, scope: "project", action: "request-change", title: `Solicitud modificación proyecto: ${p.title}`, snapshot: p.data } });
  res.json({ ok: true });
});

/* ============================ UPLOADS ============================ */
r.post("/api/upload", requireAuth, upload.array("files", 30), async (req: any, res) => {
  const files = req.files as Express.Multer.File[] || [];
  const out: any[] = [];
  const { fieldKey } = req.body;
  for (const f of files) {
    const { key, url } = await storeFile(f.buffer, f.originalname, f.mimetype);
    const rec = await prisma.file.create({
      data: { userId: req.userId, key, url, name: f.originalname, size: f.size, mime: f.mimetype,fieldKey}
    });
    out.push({ id: rec.id, name: rec.name, url: rec.url, size: rec.size, mime: rec.mime,
      fieldKey: rec.fieldKey });
  }
  res.json({ files: out });
});

/* ============================ HISTORIAL & BANDEJA ============================ */
r.get("/api/history/mine", requireAuth, async (req: any, res) => {
  const items = await prisma.historyEntry.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" }
  });
  res.json({ items });
});

r.post("/api/history/add", requireAuth, async (req: any, res) => {
  const { scope, action, snapshot, title, status, pdfUrl } = req.body || {};
  const h = await prisma.historyEntry.create({
    data: { userId: req.userId, scope, action, snapshot, title: title || action, status, pdfUrl }
  });
  res.json({ ok: true, id: h.id });
});

r.get("/api/inbox", requireAuth, async (req: any, res) => {
  const items = await prisma.inboxItem.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" }
  });
  res.json({ items });
});

/* ============================ GENERAR PDF ============================ */
/** Genera un PDF con el snapshot enviado y lo guarda en disco/S3.
 *  Devuelve { pdfUrl } y registra HistoryEntry si se especifica scope/action/title.
 */
r.post("/api/pdf/generate", requireAuth, async (req: any, res) => {
  const { title = "Reporte", snapshot = {}, scope, action } = req.body || {};
  try {
    // Crear PDF en memoria
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", async () => {
      const buf = Buffer.concat(chunks);
      const { url } = await storeFile(buf, `${Date.now()}-reporte.pdf`, "application/pdf");
      // opcional: guardar en historial
      if (scope && action) {
        await prisma.historyEntry.create({
          data: { userId: req.userId, scope, action, title, snapshot, pdfUrl: url }
        });
      }
      res.json({ ok: true, pdfUrl: url });
    });

    // Render simple: título y pares clave/valor
    doc.fontSize(18).text(title, { underline: true });
    doc.moveDown();
    const entries = Object.entries(snapshot || {});
    doc.fontSize(11);
    for (const [k, v] of entries) {
      const val = (Array.isArray(v) || typeof v === "object") ? JSON.stringify(v) : String(v ?? "");
      doc.text(`${k}: ${val}`);
      doc.moveDown(0.2);
    }
    doc.end();
  } catch (e) {
    res.status(500).json({ error: "No se pudo generar PDF" });
  }
});



export default r;
