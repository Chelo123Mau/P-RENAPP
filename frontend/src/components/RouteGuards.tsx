import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authJson } from "../api"; // usa tu helper que agrega Authorization

type Props = { children: React.ReactNode };

export default function GuardReviewer({ children }: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    allow: boolean;
    redirect?: string;
  }>({ loading: true, allow: false });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem("token") || "";
        if (!token) {
          if (mounted) setState({ loading: false, allow: false, redirect: "/login" });
          return;
        }

        // 👇 Fuente de verdad del backend
        const me = await authJson("/api/auth/me");

        if (!me.ok) {
          if (mounted) setState({ loading: false, allow: false, redirect: "/login" });
          return;
        }

        const role = String(me.data?.role || "").toLowerCase();
        const isApproved = Boolean(me.data?.isApproved);

        // 1) Si es staff, permitir /review
        if (role === "admin" || role === "reviewer") {
          if (mounted) setState({ loading: false, allow: true });
          return;
        }

        // 2) Si NO está aprobado, mandarlo a completar registro
        if (!isApproved) {
          if (mounted) setState({ loading: false, allow: false, redirect: "/register" });
          return;
        }

        // 3) Usuario normal aprobado → a su panel
        if (mounted) setState({ loading: false, allow: false, redirect: "/panel" });
      } catch {
        if (mounted) setState({ loading: false, allow: false, redirect: "/login" });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return <div className="p-6 text-center text-sm opacity-80">Verificando permisos…</div>;
  }
  if (!state.allow) {
    return <Navigate to={state.redirect || "/login"} replace />;
  }
  return <>{children}</>;
}

