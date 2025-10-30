"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memGetEntidadById = memGetEntidadById;
exports.memGetEntidadEstadoByUser = memGetEntidadEstadoByUser;
const express_1 = require("express");
const guards_1 = require("../middleware/guards");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const MEM_ENTIDADES = {}; // por id
const MEM_USER_ENTITY = {}; // userId -> entidadId
function memCrearEntidadDraft(userId, payload) {
    const id = (0, uuid_1.v4)();
    const ent = {
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
function memGetEntidadByUser(userId) {
    const id = MEM_USER_ENTITY[userId];
    return id ? MEM_ENTIDADES[id] : null;
}
function memSetEstadoEntidad(id, estado) {
    const e = MEM_ENTIDADES[id];
    if (e)
        e.estado = estado;
}
/** =========================
 *  ENDPOINTS
 *  ========================= */
/** Crear borrador de entidad (solo si el usuario NO tiene una) */
router.post('/register/entidad/draft', guards_1.requireAuth, guards_1.ensureSingleEntity, (req, res) => {
    const user = req.user;
    const ent = memCrearEntidadDraft(user.id, req.body || {});
    // reflejar en req.user para el resto del ciclo (si tu auth refresca token, hazlo allí)
    user.entidadId = ent.id;
    user.entidadEstado = ent.estado;
    return res.json({ ok: true, id: ent.id, entidad: ent });
});
/** Enviar entidad a revisión (si ya existe el borrador) */
router.post('/register/entidad/submit', guards_1.requireAuth, (req, res) => {
    const user = req.user;
    const ent = memGetEntidadByUser(user.id);
    if (!ent)
        return res.status(400).json({ error: 'No tienes entidad para enviar' });
    // Ya está EN_REVISION por defecto en draft; aquí solo confirmamos
    memSetEstadoEntidad(ent.id, 'EN_REVISION');
    user.entidadEstado = 'EN_REVISION';
    return res.json({ ok: true });
});
/** (Opcional) Endpoint para que un revisor apruebe/rechace una entidad */
router.post('/review/entidad/:id/approve', guards_1.requireAuth, (req, res) => {
    const { id } = req.params;
    memSetEstadoEntidad(id, 'APROBADA');
    // en un backend real, también marcarías quién aprobó (admin/reviewer)
    return res.json({ ok: true });
});
router.post('/review/entidad/:id/reject', guards_1.requireAuth, (req, res) => {
    const { id } = req.params;
    memSetEstadoEntidad(id, 'RECHAZADA');
    return res.json({ ok: true });
});
exports.default = router;
/** =========================
 *  Helpers para usar desde otros módulos (p.ej. /api/me)
 *  ========================= */
function memGetEntidadById(id) {
    return MEM_ENTIDADES[id] || null;
}
function memGetEntidadEstadoByUser(userId) {
    const e = memGetEntidadByUser(userId);
    return e?.estado || 'SIN_ENTIDAD';
}
