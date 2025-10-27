import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";
import { requireAuth, requireStaff } from "./middleware/auth";
import { storeFile } from "./storage";
import { title } from "process";

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
     LISTA DE USUARIOS (SIN HISTORIAL)
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
   REVIEW: LISTA DE ENTIDADES (compatible con /api/review/users)
   - Columnas requeridas: Nombre | Usuario que la registró | Aprobado | Mail
   - Mismo shape que usuarios: username, email, isApproved, entityName, role
========================================================= */
r.get("/api/review/entities", requireAuth, requireStaff, async (req: any, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize || "20", 10)));
  const q = String(req.query.q || "").trim();

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },              // busca por Nombre de entidad
      
    ];
  }

  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      include: { user: { select: { id: true, email: true,} } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.entity.count({ where }),
  ]);

  // 🔁 Shape compatible con /api/review/users
  const mapped = items.map((e) => ({
    id: e.id,
    username: e.name ?? null,                           // ← "Nombre" va en username (misma columna)
    email: e.user?.email ?? null,                      // ← "Mail" del usuario que registró
    status: e.status ?? null,                          // 
    entityId: e.id ?? null,                            // compatibilidad (no usado, pero mismo nombre)
    entityName: e.name ?? null,                        // compatibilidad para la tabla existente
    role: null,                                        // compatibilidad (tabla la espera)
    // opcional: si tu UI muestra "Usuario que la registró" desde username/email del user,
    // ya está cubierto con email; si necesitas el nombre del registrante:
    // registrarName: e.user?.fullName ?? null,
  }));

  return res.json({ ok: true, data: { items: mapped, meta: { page, pageSize, total } } });
});


/* =========================================================
   REVIEW: LISTA DE PROYECTOS (compatible con /api/review/users y entidades)
   - Columnas esperadas en UI: Nombre | Usuario que la registró | Aprobado/Status | Mail
   - Shape devuelto: { id, username, email, status, entityId, entityName, role }
========================================================= */
r.get("/api/review/projects", requireAuth, requireStaff, async (req: any, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize || "20", 10)));
  const q = String(req.query.q || "").trim();

  const where: any = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } }, // busca por Nombre del proyecto
      // si luego quieres también por email del registrante, puedes añadir:
      // { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        user: { select: { id: true, email: true } },   // quien registró el proyecto
        entity: { select: { id: true, name: true } },  // entidad asociada (si aplica)
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  // 🔁 Shape compatible con /api/review/users y /api/review/entities
  const mapped = items.map((p) => ({
    id: p.id,
    title: p.title ?? null,                 // ← "Nombre" del proyecto va en username
    email: p.user?.email ?? null,             // ← Mail del usuario que registró
    status: p.status ?? null,                 // ← status como lo tienes en entidades
    entityId: p.entity?.id ?? null,           // compatibilidad
    entityName: p.entity?.name ?? null,
           
    role: null,                               // compatibilidad (la tabla lo espera)
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
    where: { userId: id, docType: "USUARIO"},
    select: { id: true, name: true, url: true, mime: true, size: true, createdAt: true, fieldKey: true, docType: true, },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ ok: true, data: { items: files } });
});

/* =========================================================
   DOCUMENTOS DE ENTIDAD
========================================================= */

r.get("/api/entities/:id/documents", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  const files = await prisma.file.findMany({
    where: {
      entityId: id,       // 👈 deben pertenecer a la entidad indicada
      docType: "ENTIDAD", // 👈 y además ser de tipo ENTIDAD
    },
    select: {
      id: true,
      name: true,
      url: true,
      mime: true,
      size: true,
      createdAt: true,
      fieldKey: true,
      draftKey: true,
      docType: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ ok: true, data: { items: files } });
});

/* =========================================================
   DOCUMENTOS DE Proyecto
========================================================= */

r.get("/api/projects/:id/documents", requireAuth, requireStaff, async (req: any, res) => {
  const id = req.params.id;

  const files = await prisma.file.findMany({
    where: {
      projectId: id,       // 👈 archivos que pertenecen al proyecto actual
      docType: "PROYECTO", // 👈 y que son tipo PROYECTO
    },
    select: {
      id: true,
      name: true,
      url: true,
      mime: true,
      size: true,
      createdAt: true,
      fieldKey: true,
      draftKey: true,
      docType: true,
    },
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

// routes.ts
r.get("/api/entities/:id/profile", requireAuth, requireStaff, async (req: any, res) => {
  const id = String(req.params.id);

  const ent = await prisma.entity.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      data: true,

      telefono: true,
      correo: true,
      web: true,
      direccion: true,
      tipoEntidad: true,
      fechaConstitucion: true,
      municipioConstitucion: true,
      representanteLegal: true,
      numeroComercial: true,
      nit: true,
      nacionalOExtranjera: true,

      createdAt: true,
      updatedAt: true,
    },
  });

  if (!ent) return res.status(404).json({ ok: false, error: "Entidad no encontrada" });

  // Derivar campos útiles que quizá estén en ent.data (opcional)
  const d: any = ent.data || {};
  const derived = {
    // si en el form guardaste esto dentro de 'data'
    pais: d.pais ?? null,
    departamento: d.departamento ?? null,
    ciudad: d.ciudad ?? null,
  };

  return res.json({
    ok: true,
    data: {
      ...ent,
      ...derived,
    },
  });
});


// ✅ Reemplazo (no-op)
r.post("/api/entities/draft", requireAuth, async (_req: any, res) => {
  res.json({ ok: true }); });// sin escribir history

// POST /api/entities
r.post("/api/entities", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;

  // Evita duplicados: 1 entidad por usuario
  const hasOne = await prisma.entity.findFirst({ where: { userId } });
  if (hasOne) {
    return res.status(400).json({ error: "Ya existe una entidad para este usuario" });
  }

  // Body esperado: { name: string, data: any, draftKey: string }
  const { name, data, draftKey } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Falta 'name' en el body" });
  }
  if (!draftKey || typeof draftKey !== "string") {
    return res.status(400).json({ error: "Falta 'draftKey' en el body" });
  }

  // ====== Mapeo a columnas normalizadas ======
  const telefono              = data?.telefono ?? data?.phone ?? null;
  const correo                = data?.correo ?? null;
  const web                   = data?.web ?? null;
  const direccion             = data?.direccion ?? null;
  const tipoEntidad           = data?.tipoEntidad ?? null;
  const fechaConstitucion     = data?.fechaConstitucion ?? null;
  const municipioConstitucion = data?.municipioConstitucion ?? null;
  const representanteLegal    = data?.representanteLegal ?? null;
  const numeroComercial       = data?.numeroComercial ?? null;
  const nit                   = data?.nit ?? null;
  const nacionalOExtranjera   = data?.nacionalOExtranjera ?? null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Crear entidad
      const entity = await tx.entity.create({
        data: {
          userId,
          name: name.trim(),
          data,
          status: "ENVIADO",
          telefono,
          correo,
          web,
          direccion,
          tipoEntidad,
          fechaConstitucion,
          municipioConstitucion,
          representanteLegal,
          numeroComercial,
          nit,
          nacionalOExtranjera,
        },
      });

      // 2) Reasignar archivos del draft a la entidad
      const reassigned = await tx.file.updateMany({
        where: {
          draftKey,
          createdByUserId: userId, // asegura que solo muevas archivos del usuario autenticado
        },
        data: {
          entityId: entity.id,  // 🔗 vincula con la entidad
          entityName: name,     // opcional: desnormalización para tu UI
          draftKey: null,       // limpia el borrador
        },
      });

      // (Opcional) log útil de depuración; HistoryEntry está @@ignore en tu schema
      if (reassigned.count === 0) {
        console.warn(
          `[files] No se reasignaron archivos (draftKey=${draftKey}, userId=${userId}). ` +
          `Verifica que FileUpload envíe draftKey y createdByUserId correctamente.`
        );
      }

      return { entity, reassignedCount: reassigned.count };
    });

    // Devuelve solo la entidad (o incluye el count si te sirve en el front)
    return res.json(result.entity);
  } catch (err) {
    console.error("POST /api/entities error:", err);
    return res.status(500).json({ error: "Error al crear la entidad" });
  }
});


r.post("/api/entities/:id/request-change", requireAuth, async (req: any, res) => {
  const id = req.params.id;
  const e = await prisma.entity.findFirst({ where: { id, userId: req.userId } });
  if (!e) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

/* ============================ PROYECTOS ============================ */
r.get("/api/projects/mine", requireAuth, async (req: any, res) => {
  const items = await prisma.project.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
  res.json(items);
});

r.get("/api/projects/:id/profile", requireAuth, requireStaff, async (req: any, res) => {
  const id = String(req.params.id);
  const proj = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      summary: true,
      data: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!proj) return res.status(404).json({ ok: false, error: "Proyecto no encontrado" });
  res.json({ ok: true, data: proj });
});


r.post("/api/projects/draft", requireAuth, async (req: any, res) => {
  
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
  
  res.json(p);
});

r.post("/api/projects/:id/request-change", requireAuth, async (req: any, res) => {
  const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!p) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

/* ============================ UPLOADS ============================ */
// Sube hasta 30 archivos en el campo "files"
r.post("/api/upload", requireAuth, upload.array("files", 30), async (req: any, res) => {
  try {
    const userId: string = req.userId;

    // 👇 Con multipart/form-data llegan como strings en req.body
    const draftKey = String(req.body.draftKey || "");
    const fieldKey = String(req.body.fieldKey || "");
    const docType = String(req.body.docType || "");

    if (!fieldKey) {
      return res.status(400).json({ error: "Falta 'fieldKey' en el body del form-data" });
    }
    if (!draftKey) {
      // Recomendado: exigir draftKey para poder reasignar luego
      return res.status(400).json({ error: "Falta 'draftKey' en el body del form-data" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return res.status(400).json({ error: "No se recibieron archivos (campo 'files')" });
    }

    const out: any[] = [];

    for (const f of files) {
      const { key, url } = await storeFile(f.buffer, f.originalname, f.mimetype);

      const rec = await prisma.file.create({
        data: {
          
          draftKey,
          fieldKey,
          createdByUserId: userId, // MUY importante
          
          // datos del archivo
          key,
          url,
          name: f.originalname,
          size: f.size ?? null,
          mime: f.mimetype ?? null,

          // Asegúrate de NO setear entityId/Name aquí (se asignan al enviar el formulario)
          entityId: null,
          entityName: null,
          
        },
      });

      out.push({
        id: rec.id,
        name: rec.name,
        url: rec.url,
        size: rec.size,
        mime: rec.mime,
        fieldKey: rec.fieldKey,
        draftKey: rec.draftKey,
        docType: rec.docType,
      });
    }

    return res.json({ files: out });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return res.status(500).json({ error: "Error al subir archivo(s)" });
  }
});


/* ============================ HISTORIAL & BANDEJA ============================ */
// HISTORY — STUBS SIN BD
r.get("/api/history/mine", requireAuth, async (_req: any, res) => {
  // Devolvemos la misma forma { items: [...] } pero vacío, sin consultar Prisma.
  res.json({ items: [] });
});

r.post("/api/history/add", requireAuth, async (_req: any, res) => {
  // Aceptamos la llamada y devolvemos OK para no romper el front.
  // Si el front usa id, devolvemos un id sintético.
  const fakeId = `HIST-${Date.now()}`;
  res.json({ ok: true, id: fakeId });
});

// INBOX — STUB SIN BD
r.get("/api/inbox", requireAuth, async (_req: any, res) => {
  res.json({ items: [] });
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
