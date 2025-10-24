import { Router } from 'express';
import { requireAuth, ensureEntityApprovedForProject } from '../middleware/guards';
import { v4 as uuid } from 'uuid';

const router = Router();

/** =========================
 *  TEMP: repositorio en memoria
 *  Reemplaza por tu capa de datos real
 *  ========================= */
type Proyecto = {
  id: string;
  entidadId: string;
  userId: string;
  nombre: string;
  estado: 'BORRADOR' | 'EN_REVISION' | 'APROBADO' | 'OBSERVADO';
  createdAt: string;
  extras?: Record<string, any>;
};
const MEM_PROYECTOS: Record<string, Proyecto> = {};

function memCrearProyectoDraft(userId: string, entidadId: string, payload: any): Proyecto {
  const id = uuid();
  const p: Proyecto = {
    id,
    entidadId,
    userId,
    nombre: payload?.nombre || payload?.nombreProyecto || 'Proyecto sin nombre',
    estado: 'BORRADOR',
    createdAt: new Date().toISOString(),
    extras: payload?.extras || {},
  };
  MEM_PROYECTOS[id] = p;
  return p;
}
function memSetProyectoEstado(id: string, estado: Proyecto['estado']) {
  const p = MEM_PROYECTOS[id];
  if (p) p.estado = estado;
}

/** =========================
 *  ENDPOINTS
 *  ========================= */

/** Crear borrador de proyecto (requiere ENTIDAD APROBADA) */
router.post('/register/proyecto/draft', requireAuth, ensureEntityApprovedForProject, (req, res) => {
  const user = req.user as any;
  const entidadId = user.entidadId as string;
  const p = memCrearProyectoDraft(user.id, entidadId, req.body || {});
  return res.json({ ok: true, id: p.id, proyecto: p });
});

/** Enviar proyecto a revisión (requiere ENTIDAD APROBADA) */
router.post('/register/proyecto/submit', requireAuth, ensureEntityApprovedForProject, (req, res) => {
  const { id } = req.body || {};
  if (!id || !MEM_PROYECTOS[id]) return res.status(400).json({ error: 'Proyecto no encontrado' });
  memSetProyectoEstado(id, 'EN_REVISION');
  return res.json({ ok: true });
});

export default router;
