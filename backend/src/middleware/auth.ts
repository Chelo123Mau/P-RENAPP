import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/** Verifica el JWT, añade userId y role a req */
export function requireAuth(
  req: Request & { userId?: string; role?: string },
  res: Response,
  next: NextFunction
) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta token de autorización" });
  }

  const token = h.slice(7);
  try {
    const secret = process.env.JWT_SECRET || "dev";
    const payload = jwt.verify(token, secret) as any;

    // Extrae el id del usuario desde el token.
    // Aceptamos varias claves comunes: userId, id o sub.
    const uid: unknown = payload?.userId ?? payload?.id ?? payload?.sub;
    const role: unknown = payload?.role ?? payload?.rol ?? payload?.scope;

    if (typeof uid !== "string" || uid.trim() === "") {
      return res.status(401).json({ error: "Token inválido (sin userId)" });
    }

    req.userId = uid;
    if (typeof role === "string") req.role = role;

    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/** Permite solo ADMIN o REVIEWER */
export function requireStaff(
  req: Request & { role?: string },
  res: Response,
  next: NextFunction
) {
  if (req.role === "ADMIN" || req.role === "REVIEWER") return next();
  return res.status(403).json({ error: "Sin permiso para acceder" });
}


