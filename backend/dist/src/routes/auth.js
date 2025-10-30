"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const guards_1 = require("../middleware/guards");
const entidad_1 = require("./entidad");
const router = (0, express_1.Router)();
router.get('/me', guards_1.requireAuth, (req, res) => {
    const user = req.user;
    let entidadEstado = 'SIN_ENTIDAD';
    if (user?.entidadId) {
        const ent = (0, entidad_1.memGetEntidadById)(user.entidadId);
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
exports.default = router;
