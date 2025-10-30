"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireStaff = requireStaff;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/** Verifica el JWT, añade userId y role a req */
function requireAuth(req, res, next) {
    const h = String(req.headers.authorization || "");
    if (!h.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Falta token de autorización" });
    }
    const token = h.slice(7);
    try {
        const secret = process.env.JWT_SECRET || "dev";
        const payload = jsonwebtoken_1.default.verify(token, secret);
        // Extrae el id del usuario desde el token.
        // Aceptamos varias claves comunes: userId, id o sub.
        const uid = payload?.userId ?? payload?.id ?? payload?.sub;
        const role = payload?.role ?? payload?.rol ?? payload?.scope;
        if (typeof uid !== "string" || uid.trim() === "") {
            return res.status(401).json({ error: "Token inválido (sin userId)" });
        }
        req.userId = uid;
        if (typeof role === "string")
            req.role = role;
        return next();
    }
    catch (_err) {
        return res.status(401).json({ error: "Token inválido" });
    }
}
/** Permite solo ADMIN o REVIEWER */
function requireStaff(req, res, next) {
    if (req.role === "ADMIN" || req.role === "REVIEWER")
        return next();
    return res.status(403).json({ error: "Sin permiso para acceder" });
}
