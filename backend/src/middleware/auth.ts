import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/** Verifica el JWT, añade userId y role a req */
export function requireAuth(
  req: Request & { userId?: string; role?: string },
  res: Response,
  next: NextFunction
) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "Falta token de autorización" });

  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev") as any;
    req.userId = payload.sub;
    req.role = String(payload.role || "").toLowerCase();
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/** Permite solo ADMIN o REVIEWER */
export function requireStaff(
  req: Request & { role?: string },
  res: Response,
  next: NextFunction
) {
  if (req.role === "admin" || req.role === "reviewer") return next();
  return res.status(403).json({ error: "Sin permiso para acceder" });
}

