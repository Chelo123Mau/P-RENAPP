import { Router } from 'express';
import { requireAuth } from '../middleware/guards';
import { memGetEntidadById } from './entidad';

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  const user = req.user as any;
  let entidadEstado: 'APROBADA'|'EN_REVISION'|'RECHAZADA'|'SIN_ENTIDAD' = 'SIN_ENTIDAD';
  if (user?.entidadId) {
    const ent = memGetEntidadById(user.entidadId);
    entidadEstado = ent?.estado || 'SIN_ENTIDAD';
  }
  return res.json({
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    approved: user.approved || 'APROBADO', // si lo usas en UI
    entidadId: user.entidadId || null,
    entidadEstado,
  });
});

export default router;
