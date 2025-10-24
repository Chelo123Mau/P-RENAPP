import { Router } from 'express';
import { requireAuth, ensureSingleEntity, EntidadEstado } from '../middleware/guards';
import { v4 as uuid } from 'uuid';

const router = Router();

/** =========================
 *  TEMP: repositorio en memoria
 *  Reemplaza por tu capa de datos real
 *  ========================= */
type Entidad = {
  id: string;
  userId: string;
  nombre: string;
  estado: EntidadEstado; // APROBADA | EN_REVISION | RECHAZADA
  createdAt: string;
  extras?: Record<string, any>;
};

const MEM_ENTIDADES: Record<string, Entidad> = {}; // por id
const MEM_USER_ENTITY: Record<string, string> = {}; // userId -> entidadId

function memCrearEntidadDraft(userId: string, payload: any): Entidad {
  const id = uuid();
  const ent: Entidad = {
    id, userId,
    nombre: payload?.nombre || payload?.nombreInstitucion || 'Entidad sin nombre',
    estado: 'EN_REVISION',
    createdAt: new Date().toISOString(),
    extras: payload?.extras || {},
  };
  MEM_ENTIDADES[id] = ent;
  MEM_USER_ENTITY[userId] = id;
  return ent;
}
function memGetEntidadByUser(userId: string): Entidad | null {
  const id = MEM_USER_ENTITY[userId];
  return id ? MEM_ENTIDADES[id] : null;
}
function memSetEstadoEntidad(id: string, estado: EntidadEstado) {
  const e = MEM_ENTIDADES[id];
  if (e) e.estado = estado;
}

/** =========================
 *  ENDPOINTS
 *  ========================= */

/** Crear borrador de entidad (solo si el usuario NO tiene una) */
router.post('/register/entidad/draft', requireAuth, ensureSingleEntity, (req, res) => {
  const user = req.user as any;
  const ent = memCrearEntidadDraft(user.id, req.body || {});
  // reflejar en req.user para el resto del ciclo (si tu auth refresca token, hazlo allí)
  user.entidadId = ent.id;
  user.entidadEstado = ent.estado;
  return res.json({ ok: true, id: ent.id, entidad: ent });
});

/** Enviar entidad a revisión (si ya existe el borrador) */
router.post('/register/entidad/submit', requireAuth, (req, res) => {
  const user = req.user as any;
  const ent = memGetEntidadByUser(user.id);
  if (!ent) return res.status(400).json({ error: 'No tienes entidad para enviar' });
  // Ya está EN_REVISION por defecto en draft; aquí solo confirmamos
  memSetEstadoEntidad(ent.id, 'EN_REVISION');
  user.entidadEstado = 'EN_REVISION';
  return res.json({ ok: true });
});

/** (Opcional) Endpoint para que un revisor apruebe/rechace una entidad */
router.post('/review/entidad/:id/approve', requireAuth, (req, res) => {
  const { id } = req.params;
  memSetEstadoEntidad(id, 'APROBADA');
  // en un backend real, también marcarías quién aprobó (admin/reviewer)
  return res.json({ ok: true });
});
router.post('/review/entidad/:id/reject', requireAuth, (req, res) => {
  const { id } = req.params;
  memSetEstadoEntidad(id, 'RECHAZADA');
  return res.json({ ok: true });
});

export default router;

/** =========================
 *  Helpers para usar desde otros módulos (p.ej. /api/me)
 *  ========================= */
export function memGetEntidadById(id: string): Entidad | null {
  return MEM_ENTIDADES[id] || null;
}
export function memGetEntidadEstadoByUser(userId: string): EntidadEstado {
  const e = memGetEntidadByUser(userId);
  return e?.estado || 'SIN_ENTIDAD';
}
