"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.ensureSingleEntity = ensureSingleEntity;
exports.ensureEntityApprovedForProject = ensureEntityApprovedForProject;
// Asumiendo que en req.user está el user autenticado (id, role, entidadId, etc.)
function requireAuth(req, res, next) {
    if (!req.user)
        return res.status(401).json({ error: 'No autorizado' });
    next();
}
// Impide crear más de 1 entidad por usuario
function ensureSingleEntity(req, res, next) {
    const user = req.user;
    if (user?.entidadId) {
        return res.status(409).json({ error: 'El usuario ya tiene una entidad registrada' });
    }
    next();
}
// Para registrar un proyecto, la entidad del usuario debe estar APROBADA
function ensureEntityApprovedForProject(req, res, next) {
    const user = req.user;
    if (!user?.entidadId) {
        return res.status(400).json({ error: 'Debes registrar una entidad antes de crear un proyecto' });
    }
    // entityStatus pudo ser cargado previamente en req.user o recupéralo desde tu store/DB
    if (user?.entidadEstado !== 'APROBADA') {
        return res.status(403).json({ error: 'Tu entidad debe estar APROBADA para registrar proyectos' });
    }
    next();
}
