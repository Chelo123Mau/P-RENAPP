// src/guards/GuardReviewer.tsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authJson } from "../api";
import { decideHome } from "../routeDecider";

export default function GuardReviewer({ children }: { children: React.ReactNode }) {
  const [res, setRes] = useState<{ loading: boolean; allow: boolean; redirect?: string }>({
    loading: true,
    allow: false,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          if (alive) setRes({ loading: false, allow: false, redirect: "/login" });
          return;
        }

        const me = await authJson("/api/auth/me");
        if (!me.ok) {
          if (alive) setRes({ loading: false, allow: false, redirect: "/login" });
          return;
        }

        const role = String(me.data?.role || "").toLowerCase();
        if (role === "admin" || role === "reviewer") {
          if (alive) setRes({ loading: false, allow: true });
          return;
        }

        // Si no es staff, decidir su destino (register o panel)
        const dest = decideHome(me.data || {});
        if (alive) setRes({ loading: false, allow: false, redirect: dest });
      } catch {
        if (alive) setRes({ loading: false, allow: false, redirect: "/login" });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (res.loading)
    return <div className="p-6 text-center text-sm opacity-80">Verificando permisos…</div>;
  if (!res.allow) return <Navigate to={res.redirect || "/login"} replace />;
  return <>{children}</>;
}
