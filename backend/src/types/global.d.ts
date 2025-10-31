// src/types/global.d.ts
declare global {
  namespace Express {
    interface UserJWT {
      id: string;
      role?: "ADMIN" | "REVIEWER" | "USER";
      email?: string;
    }
    interface Request {
      user?: UserJWT;
      userId?: string;
      role?: "ADMIN" | "REVIEWER" | "USER";
    }
  }
}
export {};
