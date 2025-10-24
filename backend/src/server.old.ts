import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import path from 'path'; import fs from 'fs'; import { v4 as uuid } from 'uuid';
import { uploader, fileMeta } from './upload'; import { generarPDFReporte } from './pdf'; import { enviarReportePorEmail } from './email';
import { ApproveState, DraftState, Estado, RefTipo, ReportTipo, Archivo, DB, RegistroBase, Entidad, Proyecto, User } from './models';
import entidadRouter from './routes/entidad';
import proyectoRouter from './routes/proyecto';
import PDFDocument from 'pdfkit';


const app=express(); app.use(cors()); app.use(express.json({limit:'30mb'}));

// =================== AUTH mínima: signup + login ===================
app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username y password son requeridos' });

  const ya = Array.from(db.users.values()).find((u:any) => u.username === username);
  if (ya) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

  const id = uuid();
  const nuevo:any = {
    id, username, password, // (en producción: hashear)
    role:'user',
    approved: ApproveState.PENDIENTE,
    createdAt: new Date().toISOString(),
    entidadId: null,
    entidadEstado: 'SIN_ENTIDAD',
    // campos de perfil aún vacíos (se completan en /api/register/user)
    email:'', nombres:'', apellidos:''
  };
  db.users.set(id, nuevo);

  const token = `demo.${id}`; // tu método de token
  return res.json({ ok:true, token, user: { id, username, role:nuevo.role, approved:nuevo.approved } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error:'username y password son requeridos' });

  const u:any = Array.from(db.users.values()).find((x:any)=> x.username === username);
  if (!u || u.password !== password) return res.status(401).json({ error:'Usuario o password inválidos' });

  const token = `demo.${u.id}`;
  return res.json({ ok:true, token });
});


app.post('/api/register/user/draft', requireAuth, (req, res) => {
  userDrafts.set(req.userId as string, req.body || {});
  res.json({ ok:true, savedAt:new Date().toISOString() });
});

app.get('/api/register/user/draft', requireAuth, (req, res) => {
  res.json({ ok:true, draft: userDrafts.get(req.userId as string) || {} });
});


// === Borradores de perfil de usuario (solo datos de RegisterUser) ===
type UserDraft = Record<string, any>;
const userDrafts = new Map<string, UserDraft>(); // userId -> draft


type RegisterUserCanonical = {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  tipoDocumento: string;   // 'CI'
  nroDocumento: string;    // ci
  pais?: string;
  departamento?: string;
  ciudad?: string;
  direccion?: string;
  institucion?: string;
  cargo?: string;
  password: string;
  aceptaTerminos?: boolean;
  documentos?: any[];
  docsPorCampo?: Record<string, any[]>;
};

const REQUIRED_CANONICAL: (keyof RegisterUserCanonical)[] = [
  'nombres', 'apellidos', 'email', 'telefono', 'tipoDocumento', 'nroDocumento', 'institucion', 'password', 'departamento', 'ciudad', 'direccion', 'cargo'
];

function normalizeRegisterUser(raw: any): { data: RegisterUserCanonical; missing: string[] } {
  const data: RegisterUserCanonical = {
    nombres: (raw.nombres ?? '').trim(),
    apellidos: (raw.apellidos ?? '').trim(),
    email: (raw.email ?? raw.correo ?? raw.correoElectronico ?? '').trim(),
    telefono: (raw.telefono ?? raw.celular ?? '').trim(),
    tipoDocumento: (raw.tipoDocumento ?? 'CI').trim(),
    nroDocumento: (raw.nroDocumento ?? raw.ci ?? '').trim(),
    pais: (raw.pais ?? 'Bolivia').trim?.() ?? 'Bolivia',
    departamento: (raw.departamento ?? '').trim?.() ?? '',
    ciudad: (raw.ciudad ?? '').trim?.() ?? '',
    direccion: (raw.direccion ?? raw.domicilio ?? '').trim?.() ?? '',
    institucion: (raw.institucion ?? raw.entidadRepresenta ?? '').trim?.() ?? '',
    cargo: (raw.cargo ?? raw.cargoRelacion ?? '').trim?.() ?? '',
    password: (raw.password ?? '').trim(),
    aceptaTerminos: !!(raw.aceptaTerminos ?? true),
    documentos: Array.isArray(raw.documentos) ? raw.documentos : [],
    docsPorCampo: typeof raw.docsPorCampo === 'object' && raw.docsPorCampo ? raw.docsPorCampo : {},
  };

  const missing: string[] = [];
  for (const k of REQUIRED_CANONICAL) {
    const v = (data as any)[k];
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    if (empty) missing.push(k);
  }

  return { data, missing };
}


const db:DB={users:new Map(),entidades:new Map(),proyectos:new Map(),registros:new Map()};

// Acepta "Authorization: demo.<id>" o "Authorization: Bearer demo.<id>"
function requireAuth(req: any, res: any, next: any) {
  const raw = (req.headers?.authorization ?? req.headers?.Authorization ?? '').toString().trim();

  // Extrae el token, con o sin "Bearer "
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Nuestro formato simple: "demo.<userId>"
  if (!token.startsWith('demo.')) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userId = token.split('.')[1];
  if (!userId || !db.users.has(userId)) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // Pasa el id de usuario al resto de la request
  req.userId = userId;
  return next();
}

function requireApproved(req:any,res:any,next:any){const u=db.users.get(req.userId);if(!u)return res.status(401).json({error:'No user'});if(u.approved!==ApproveState.APROBADO)return res.status(403).json({error:'Usuario aún no aprobado'});next();}

app.get('/files/secure',requireAuth,(req,res)=>{const p=req.query.path as string;if(!p)return res.status(400).send('path requerido');if(!fs.existsSync(p))return res.status(404).send('Archivo no existe');res.sendFile(path.resolve(p));});
app.post('/api/upload',requireAuth,uploader.array('files',15),(req:any,res)=>{const list=(req.files||[]).map((f:any)=>fileMeta(f.path,f.originalname,f.mimetype));res.json({files:list});});

// Login clásico con username + password
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username y password son requeridos' });

  const u: any = Array.from(db.users.values()).find(x => x.username === username);
  if (!u) return res.status(401).json({ error: 'Usuario o password inválidos' });
  if (u.password !== password) return res.status(401).json({ error: 'Usuario o password inválidos' });

  const token = `demo.${u.id}`;
  return res.json({ ok: true, token });
});


// ======================================================
//  Crear usuario mínimo (username + password)
//  Devuelve token y usuario con approved = PENDIENTE
//  Luego el frontend redirige a /register-user
// ======================================================
// Crear cuenta mínima: username + password
app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username y password son requeridos' });

  const ya = Array.from(db.users.values()).find(u => (u as any).username === username);
  if (ya) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

  const id = uuid();
  const nuevo: any = {
    id,
    username,
    password, // (en producción: hashear)
    role: 'user',
    approved: ApproveState.PENDIENTE,
    createdAt: new Date().toISOString(),
    entidadId: null,
    entidadEstado: 'SIN_ENTIDAD',
    email: '',
    nombres: '',
    apellidos: ''
  };
  db.users.set(id, nuevo);

  const token = `demo.${id}`;
  return res.json({ ok: true, token, user: { id, username, role: 'user', approved: nuevo.approved } });
});



app.get('/api/me', requireAuth, (req, res) => {
  const u:any = db.users.get(req.userId)!;

  let entidadEstado:'APROBADA'|'EN_REVISION'|'RECHAZADA'|'SIN_ENTIDAD' = 'SIN_ENTIDAD';
  if (u.entidadId && db.entidades.has(u.entidadId)) {
    entidadEstado = db.entidades.get(u.entidadId)!.estado || 'SIN_ENTIDAD';
  }

  res.json({
    id: u.id,
    username: u.username || '',
    email: u.email || '',
    role: u.role,
    approved: u.approved,
    entidadId: u.entidadId || null,
    entidadEstado,
    isApproved: u.approved === ApproveState.APROBADO
  });
});




// PERFIL de usuario: completa datos de registro (SIN password)
app.post('/api/register/user', requireAuth, (req, res) => {
  const raw = req.body || {};
  const u:any = db.users.get(req.userId)!;

  const email = String(raw.email ?? '').trim();
  const nombres = String(raw.nombres ?? '').trim();
  const apellidos = String(raw.apellidos ?? '').trim();
  const tipoDocumento = String(raw.tipoDocumento ?? 'CI').trim();
  const nroDocumento = String(raw.nroDocumento ?? raw.ci ?? '').trim();
  const pais = raw.pais ?? 'Bolivia';
  const departamento = raw.departamento ?? '';
  const ciudad = raw.ciudad ?? '';
  const direccion = raw.direccion ?? raw.domicilio ?? '';
  const institucion = raw.institucion ?? raw.entidadRepresenta ?? '';
  const cargo = raw.cargo ?? raw.cargoRelacion ?? '';
  const telefono = String(raw.telefono ?? '').trim();

  if (!email || !nombres || !apellidos || !tipoDocumento || !nroDocumento) {
    return res.status(400).json({ error:'Faltan campos obligatorios del usuario', missing: ['email','nombres','apellidos','tipoDocumento','nroDocumento'].filter(k=>{
      const m:{[k:string]:any} = {email,nombres,apellidos,tipoDocumento,nroDocumento};
      return !m[k];
    })});
  }

  // NO tocar u.password aquí
  u.email = email;
  u.nombres = nombres;
  u.apellidos = apellidos;
  u.tipoDocumento = tipoDocumento;
  u.nroDocumento = nroDocumento;
  u.pais = pais;
  u.departamento = departamento;
  u.ciudad = ciudad;
  u.direccion = direccion;
  u.institucion = institucion;
  u.cargo = cargo;
  u.telefono = telefono;
  u.updatedAt = new Date().toISOString();

  db.users.set(u.id, u);

  // Generar registro para revisión (si no existe aún)
  const campos = [
    { key:'nombres', label:'Nombres', value:nombres },
    { key:'apellidos', label:'Apellidos', value:apellidos },
    { key:'email', label:'Correo', value:email },
    { key:'tipoDocumento', label:'Tipo de documento', value:tipoDocumento },
    { key:'nroDocumento', label:'Nro documento', value:nroDocumento },
    { key:'pais', label:'País', value:pais||'' },
    { key:'departamento', label:'Departamento', value:departamento||'' },
    { key:'ciudad', label:'Ciudad/Municipio', value:ciudad||'' },
    { key:'direccion', label:'Dirección', value:direccion||'' },
    { key:'institucion', label:'Institución', value:institucion||'' },
    { key:'cargo', label:'Cargo', value:cargo||'' },
    { key:'telefono', label:'Teléfono', value:telefono||'' },
  ];
  const reg:RegistroBase = {
    id: u.id,
    tipo: RefTipo.USUARIO,
    solicitanteNombre: `${nombres}${apellidos ? ' ' + apellidos : ''}`,
    solicitanteEmail: email,
    estado: Estado.REVISION,
    enviadaAt: new Date().toISOString(),
    formulario: { campos, documentos: (raw.documentos||[]) as Archivo[], docsPorCampo: (raw.docsPorCampo||{}) as Record<string,Archivo[]> },
    reportes: []
  };
  db.registros.set(u.id, reg);

  return res.json({ ok:true, id:u.id });
});

// Reemplazar handler de registro de usuario


app.post('/api/register/entidad/draft',requireAuth,requireApproved,(req,res)=>{const u=db.users.get(req.userId as string)!;
  if (u.entidadId) {
  return res.status(409).json({error:'El usuario ya tiene una entidad registrada'});
};
  const {id,nombre,nit,representante,documentos,extras,docsPorCampo}=req.body||{};const entId=id||u.entidadId||uuid();const now=new Date().toISOString();
const ent=db.entidades.get(entId)||{id:entId,nombre:nombre||'',nit,representante,ownerUserId:u.id,approved:ApproveState.PENDIENTE,createdAt:now,draftState:DraftState.DRAFT,documentos:[]} as Entidad;
(ent as any).extras=extras||(ent as any).extras||{}; (ent as any).docsPorCampo=docsPorCampo||(ent as any).docsPorCampo||{};
db.entidades.set(entId,{...ent,nombre,nit,representante,draftState:DraftState.DRAFT,documentos:documentos||ent.documentos||[],extras:(ent as any).extras,docsPorCampo:(ent as any).docsPorCampo});u.entidadId=entId;db.users.set(u.id,u);
res.json({ok:true,id:entId,draftState:DraftState.DRAFT});});

app.post('/api/register/entidad/submit',requireAuth,requireApproved,(req,res)=>{const u=db.users.get(req.userId as string)!;if(!u.entidadId)return res.status(400).json({error:'No hay borrador de entidad'});const ent=db.entidades.get(u.entidadId)!;ent.draftState=DraftState.SUBMITTED;db.entidades.set(ent.id,ent);
const extras=(ent as any).extras||{};const extraCampos=Object.keys(extras).map(k=>({key:k,label:k,value:String(extras[k]??'')}));const docsPorCampo=(ent as any).docsPorCampo||{};
const reg:RegistroBase={id:ent.id,tipo:RefTipo.ENTIDAD,solicitanteNombre:u.nombre,solicitanteEmail:u.email,entidadNombre:ent.nombre,estado:Estado.REVISION,enviadaAt:new Date().toISOString(),formulario:{campos:[{key:'nombre',label:'Nombre de la entidad',value:ent.nombre},{key:'nit',label:'NIT',value:ent.nit||''},{key:'representante',label:'Representante',value:ent.representante||''},...extraCampos],documentos:ent.documentos||[],docsPorCampo},reportes:[]};
db.registros.set(ent.id,reg);res.json({ok:true,id:ent.id,draftState:ent.draftState});});

app.post('/api/register/proyecto/draft', requireAuth, requireApproved, (req, res) => {
  const u = db.users.get(req.userId as string)!;

  // 1) Debe tener una entidad
  if (!u.entidadId) {
    return res.status(400).json({ error: 'Registre una entidad primero' });
  }

  // 2) La entidad debe existir
  const ent = db.entidades.get(u.entidadId);
  if (!ent) {
    return res.status(400).json({ error: 'Entidad no encontrada' });
  }

  // 3) La entidad debe estar APROBADA (regla de negocio)
  //    Usa **un solo modelo**. Si usas `ent.estado`, deja esta línea:
  if (ent.estado !== 'APROBADA') {
    return res.status(403).json({ error: 'Tu entidad debe estar APROBADA para registrar proyectos' });
  }
  //    Si en tu proyecto usas `ent.approved === ApproveState.APROBADO`,
  //    reemplaza el if anterior por:
  // if (ent.approved !== ApproveState.APROBADO) {
  //   return res.status(403).json({ error: 'Tu entidad debe estar APROBADA para registrar proyectos' });
  // }

  // 4) Crear/actualizar borrador del proyecto
  const { id, nombre, documentos, extras, docsPorCampo } = req.body || {};
  const pid = id || uuid();
  const now = new Date().toISOString();

  const existente = db.proyectos.get(pid);
  const p = existente || ({
    id: pid,
    nombre: nombre || '',
    entidadId: ent.id,
    ownerUserId: u.id,
    approved: ApproveState?.PENDIENTE ?? 'PENDIENTE', // quítalo si no usas este campo
    createdAt: now,
    draftState: DraftState.DRAFT,
    documentos: []
  } as Proyecto);

  // Merge de borrador
  p.nombre = nombre ?? p.nombre;
  (p as any).extras = extras ?? (p as any).extras ?? {};
  (p as any).docsPorCampo = docsPorCampo ?? (p as any).docsPorCampo ?? {};
  p.draftState = DraftState.DRAFT;
  p.documentos = documentos ?? p.documentos ?? [];

  db.proyectos.set(pid, p);

  return res.json({ ok: true, id: pid, draftState: p.draftState });
});


app.post('/api/register/proyecto/submit', requireAuth, requireApproved, (req, res) => {
  const { id, documentos, extras, docsPorCampo } = req.body || {};

  // ======================================================
//  Guardar BORRADOR de RegisterUser del usuario autenticado
// ======================================================
app.post('/api/register/user/draft', requireAuth, (req, res) => {
  const u = db.users.get(req.userId)!;
  const draft = req.body || {};
  userDrafts.set(u.id, draft);
  return res.json({ ok: true, savedAt: new Date().toISOString() });
});

// ======================================================
//  Obtener BORRADOR de RegisterUser del usuario autenticado
// ======================================================
app.get('/api/register/user/draft', requireAuth, (req, res) => {
  const u = db.users.get(req.userId)!;
  const draft = userDrafts.get(u.id) || {};
  return res.json({ ok: true, draft });
});


  // 1) Validaciones básicas
  if (!id || !db.proyectos.has(id)) {
    return res.status(400).json({ error: 'Borrador de proyecto inexistente' });
  }

  // 2) Cargar proyecto y entidad
  const p = db.proyectos.get(id)!;
  const ent = db.entidades.get(p.entidadId);
  if (!ent) {
    return res.status(400).json({ error: 'Entidad no encontrada' });
  }

  // 3) Regla de negocio: la entidad debe estar APROBADA
  //    ➜ Usa uno solo de los dos if (el primero es el recomendado).
  // (A) Si tu modelo usa ent.estado:
  if (ent.estado !== 'APROBADA') {
    return res.status(403).json({ error: 'Tu entidad debe estar APROBADA para enviar el proyecto' });
  }
  // (B) Si tu modelo usa ent.approved === ApproveState.APROBADO:
  // if (ent.approved !== ApproveState.APROBADO) {
  //   return res.status(403).json({ error: 'Entidad aún no aprobada' });
  // }

  // 4) Actualizar el draft con lo último y marcar como SUBMITTED
  p.draftState = DraftState.SUBMITTED;
  if (documentos) p.documentos = documentos;
  if (docsPorCampo) (p as any).docsPorCampo = docsPorCampo;
  if (extras) (p as any).extras = extras;
  db.proyectos.set(id, p);

  // 5) Armar registro para el panel de revisión
  const pExtras = (p as any).extras || {};
  const extraCampos = Object.keys(pExtras).map(k => ({
    key: k,
    label: k,
    value: String(pExtras[k] ?? '')
  }));
  const porCampo = (p as any).docsPorCampo || {};

  const u = db.users.get(p.ownerUserId)!;

  const reg: RegistroBase = {
    id: p.id,
    tipo: RefTipo.PROYECTO,
    solicitanteNombre: u.nombre,
    solicitanteEmail: u.email,
    entidadNombre: ent.nombre,
    estado: Estado.REVISION,
    enviadaAt: new Date().toISOString(),
    formulario: {
      campos: [
        { key: 'nombre',  label: 'Nombre del proyecto', value: p.nombre },
        { key: 'entidad', label: 'Entidad',             value: ent.nombre },
        ...extraCampos
      ],
      documentos: p.documentos || [],
      docsPorCampo: porCampo
    },
    reportes: []
  };

  db.registros.set(p.id, reg);

  return res.json({ ok: true, id, draftState: p.draftState });
});


app.get('/api/review/pendientes',requireAuth,(req,res)=>{const u=db.users.get(req.userId as string)!;if(u.role!=='admin'&&u.role!=='reviewer')return res.status(403).json({error:'Sin permiso'});
const items=Array.from(db.registros.values()).filter(r=>r.estado===Estado.REVISION).map(r=>({id:r.id,tipo:r.tipo,solicitante:r.solicitanteNombre,email:r.solicitanteEmail,entidad:r.entidadNombre||'',enviadaAt:r.enviadaAt,documentos:r.formulario.documentos?.length||0}));res.json({items});});

app.get('/api/review/registro/:id',requireAuth,(req,res)=>{const u=db.users.get(req.userId as string)!;if(u.role!=='admin'&&u.role!=='reviewer')return res.status(403).json({error:'Sin permiso'});const reg=db.registros.get(req.params.id);if(!reg)return res.status(404).json({error:'Registro no encontrado'});res.json(reg);});

// ======================================================
//  Ruta: Generar informe PDF de revisión
// ======================================================
import PDFDocument from 'pdfkit'; // si no estaba arriba, agrégalo una sola vez

app.post('/api/review/:tipo/:id/report', requireAuth, (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { comentario, enviarEmail } = req.body || {};

    const reg = db.registros.get(id);
    if (!reg) return res.status(404).send('Registro no encontrado');

    // Cabeceras HTTP para descargar como PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipo}_${id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Contenido del PDF
    doc.fontSize(18).text('RENAPP - Informe de Revisión', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Tipo de informe: ${tipo.toUpperCase()}`);
    doc.text(`Registro ID: ${id}`);
    doc.text(`Fecha: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.text(`Solicitante: ${reg.solicitanteNombre || '—'}`);
    doc.text(`Correo: ${reg.solicitanteEmail || '—'}`);
    if (reg.entidadNombre) doc.text(`Entidad: ${reg.entidadNombre}`);

    doc.moveDown();
    doc.fontSize(12).text('Comentario / Observaciones:');
    doc.moveDown();
    doc.fontSize(11).text(comentario || '(sin comentarios)');

    // Datos principales del formulario
    const campos = reg.formulario?.campos || [];
    if (campos.length) {
      doc.moveDown();
      doc.fontSize(12).text('Datos del formulario:');
      campos.forEach((c: any) => {
        doc.fontSize(10).text(`• ${c.label || c.key}: ${c.value ?? ''}`);
      });
    }

    // Finaliza y envía el PDF
    doc.end();
  } catch (e: any) {
    res.status(500).send(e?.message || 'Error al generar el informe PDF');
  }
});



function addReporte(reg:RegistroBase,tipo:ReportTipo,comentario?:string){const folio='REP-'+(Math.random().toString(36).slice(2,8)).toUpperCase();const pdfPath=generarPDFReporte(path.join(process.cwd(),'backend','storage','reports'),folio,tipo===ReportTipo.APROBACION?'Reporte de Aprobación':'Reporte de Observaciones',`Folio: ${folio}\nTipo: ${reg.tipo}\nEntidad/Proyecto: ${reg.entidadNombre||''}\nSolicitante: ${reg.solicitanteNombre}\n\nComentario:\n${comentario||'-'}`);reg.reportes.push({id:uuid(),tipo,folio,createdAt:new Date().toISOString(),pdfPath,comentario});}

app.post('/api/review/:tipo/:id/approve',requireAuth,(req,res)=>{const {tipo,id}=req.params;const reg=db.registros.get(id);if(!reg)return res.status(404).json({error:'Registro no encontrado'});reg.estado=Estado.APROBADO;addReporte(reg,ReportTipo.APROBACION,req.body?.comentario||'Aprobado');
if(tipo==='USUARIO'&&db.users.has(id)){const usr=db.users.get(id)!;usr.approved=ApproveState.APROBADO;db.users.set(id,usr);} if(tipo==='ENTIDAD'&&db.entidades.has(id)){const ent=db.entidades.get(id)!;ent.approved=ApproveState.APROBADO;db.entidades.set(id,ent);} if(tipo==='PROYECTO'&&db.proyectos.has(id)){const p=db.proyectos.get(id)!;p.approved=ApproveState.APROBADO;db.proyectos.set(id,p);} res.json({ok:true});});

app.post('/api/review/:tipo/:id/observe',requireAuth,(req,res)=>{const {id}=req.params;const reg=db.registros.get(id);if(!reg)return res.status(404).json({error:'Registro no encontrado'});reg.estado=Estado.OBSERVADO;addReporte(reg,ReportTipo.OBSERVACIONES,req.body?.comentario||'Observado');res.json({ok:true});});

app.get('/api/user/submissions',requireAuth,(req,res)=>{const u=db.users.get(req.userId as string)!;let entidadOut:any=null;if(u.entidadId&&db.entidades.has(u.entidadId)){const ent=db.entidades.get(u.entidadId)!;const regEnt=db.registros.get(ent.id)||null;entidadOut={id:ent.id,nombre:ent.nombre,approved:ent.approved,draftState:ent.draftState||null,approvalMeta:ent.approvalMeta||null,registro:regEnt?{id:regEnt.id,estado:regEnt.estado,enviadaAt:regEnt.enviadaAt,reportes:(regEnt.reportes||[]).map(r=>({id:r.id,tipo:r.tipo,folio:r.folio,createdAt:r.createdAt,pdfPath:(r as any).pdfPath||''}))}:null};}
const proys=Array.from(db.proyectos.values()).filter(p=>p.ownerUserId===u.id);const proyectosOut=proys.map(p=>{const regP=db.registros.get(p.id)||null;return{id:p.id,nombre:p.nombre,entidadId:p.entidadId,approved:p.approved,draftState:p.draftState||null,approvalMeta:p.approvalMeta||null,registro:regP?{id:regP.id,estado:regP.estado,enviadaAt:regP.enviadaAt,reportes:(regP.reportes||[]).map(r=>({id:r.id,tipo:r.tipo,folio:r.folio,createdAt:r.createdAt,pdfPath:(r as any).pdfPath||''}))}:null};});res.json({userApproved:u.approved,entidad:entidadOut,proyectos:proyectosOut});});

app.get('/api/review/registro/:tipo/:id',requireAuth,(req,res)=>{
  const u=db.users.get(req.userId)!;
  if(u.role!=='admin'&&u.role!=='reviewer') return res.status(403).json({error:'Sin permisos'});
  const { id } = req.params;
  const reg = db.registros.get(id);
  if(!reg) return res.status(404).json({error:'Registro no encontrado'});
  return res.json({ registro: reg });
});


(function seed(){const u1:User={id:uuid(),email:'admin@renapp.local',password:'admin123',nombre:'Admin',role:'admin',approved:ApproveState.APROBADO};const u2:User={id:uuid(),email:'reviewer@renapp.local',password:'rev123',nombre:'Reviewer',role:'reviewer',approved:ApproveState.APROBADO};const u3:User={id:uuid(),email:'demo@renapp.local',password:'demo123',nombre:'Usuario Demo',role:'user',approved:ApproveState.APROBADO};db.users.set(u1.id,u1);db.users.set(u2.id,u2);db.users.set(u3.id,u3);console.log('Usuarios demo:',{admin:u1,reviewer:u2,demo:u3});})();
const PORT = process.env.PORT || 4000; app.listen(PORT,()=>console.log('Backend RENAPP v5 escuchando en http://localhost:'+PORT));
