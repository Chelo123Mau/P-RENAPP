// src/guards/GuardAnon.tsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authJson } from "../api";
import { decideHome } from "../routeDecider";

export default function GuardAnon({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; redirect?: string }>({ loading: true });

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return setState({ loading: false });

      try {
        const me = await authJson("/api/auth/me");
        if (!me.ok) return setState({ loading: false });
        const dest = decideHome(me.data || {});
        setState({ loading: false, redirect: dest });
      } catch {
        setState({ loading: false });
      }
    })();
  }, []);

  if (state.loading) return <div className="p-6 text-center text-sm opacity-80">Cargando…</div>;
  if (state.redirect) return <Navigate to={state.redirect} replace />;
  return <>{children}</>;
}
