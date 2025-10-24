import { Request, Response, NextFunction } from 'express';

// Asumiendo que en req.user está el user autenticado (id, role, entidadId, etc.)
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// Impide crear más de 1 entidad por usuario
export function ensureSingleEntity(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (user?.entidadId) {
    return res.status(409).json({ error: 'El usuario ya tiene una entidad registrada' });
  }
  next();
}

// Para registrar un proyecto, la entidad del usuario debe estar APROBADA
export function ensureEntityApprovedForProject(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user?.entidadId) {
    return res.status(400).json({ error: 'Debes registrar una entidad antes de crear un proyecto' });
  }
  // entityStatus pudo ser cargado previamente en req.user o recupéralo desde tu store/DB
  if (user?.entidadEstado !== 'APROBADA') {
    return res.status(403).json({ error: 'Tu entidad debe estar APROBADA para registrar proyectos' });
  }
  next();
}
