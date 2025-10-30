"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const guards_1 = require("../middleware/guards");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const MEM_PROYECTOS = {};
function memCrearProyectoDraft(userId, entidadId, payload) {
    const id = (0, uuid_1.v4)();
    const p = {
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
function memSetProyectoEstado(id, estado) {
    const p = MEM_PROYECTOS[id];
    if (p)
        p.estado = estado;
}
/** =========================
 *  ENDPOINTS
 *  ========================= */
/** Crear borrador de proyecto (requiere ENTIDAD APROBADA) */
router.post('/register/proyecto/draft', guards_1.requireAuth, guards_1.ensureEntityApprovedForProject, (req, res) => {
    const user = req.user;
    const entidadId = user.entidadId;
    const p = memCrearProyectoDraft(user.id, entidadId, req.body || {});
    return res.json({ ok: true, id: p.id, proyecto: p });
});
/** Enviar proyecto a revisión (requiere ENTIDAD APROBADA) */
router.post('/register/proyecto/submit', guards_1.requireAuth, guards_1.ensureEntityApprovedForProject, (req, res) => {
    const { id } = req.body || {};
    if (!id || !MEM_PROYECTOS[id])
        return res.status(400).json({ error: 'Proyecto no encontrado' });
    memSetProyectoEstado(id, 'EN_REVISION');
    return res.json({ ok: true });
});
exports.default = router;
