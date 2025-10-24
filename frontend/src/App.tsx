// src/App.tsx
import React from "react";
import {Routes, Route, Navigate, useNavigate } from "react-router-dom";

// Páginas (ajusta las rutas si tus archivos están en otra carpeta)
import Login from "./pages/Login";
import SignupBasic from "./pages/SignupBasic";
import RegisterUser from "./pages/RegisterUser";
import ReviewDashboard from "./pages/ReviewDashboard";
import GuardReviewer from "./guards/GuardReviewer";
import GuardAnon from "./guards/GuardAnon";
import ReviewReport from "./pages/ReviewReport";
import Panel from "./pages/Panel"; // o tu placeholde

// Helper de API (usa VITE_API_URL). Debes tener ./api.ts como te pasé.
import { authJson } from "./api";

/* ============================
   Helpers de navegación/decisión
   ============================ */
export type MeDto = { role?: string; isApproved?: boolean | null };

function decideHome(me: MeDto) {
  const role = String(me?.role || "").toLowerCase();
  const approved = Boolean(me?.isApproved);
  if (role === "admin" || role === "reviewer") return "/review";
  if (!approved) return "/register";
  return "/panel";
}

function safeNav(nav: ReturnType<typeof useNavigate>, to: string) {
  const here = window.location.pathname;
  if (here !== to) nav(to, { replace: true });
}

/* ============================
   (Opcional) Placeholders mínimos
   Si ya tienes un Panel real, impórtalo y borra este placeholder.
   ============================ */
function PanelPlaceholder() {
  return (
    <div className="min-h-screen p-6 text-gray-100 bg-[#0B1220]">
      <h1 className="text-2xl font-semibold mb-2">Panel de Usuario</h1>
      <p className="opacity-80">Aquí va tu panel de usuario aprobado.</p>
    </div>
  );
}

/* ============================
   App principal con rutas
   ============================ */
export default function App() {
  return (
    
      <Routes>
        {/* Home → redirige a login (guardará sesión si ya por GuardAnon) */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Públicas (sólo si NO estás logueado) */}
        <Route
          path="/login"
          element={
            <GuardAnon>
              <Login />
            </GuardAnon>
          }
        />
        <Route
          path="/signup"
          element={
            <GuardAnon>
              <SignupBasic />
            </GuardAnon>
          }
        />

        {/* Privadas - revisor/admin */}
        <Route
          path="/review"
          element={
            <GuardReviewer>
              <ReviewDashboard />
            </GuardReviewer>
          }
        /> <Route 
          path="/review/report" 
          element={ 
             <GuardReviewer>
              <ReviewReport />
                  </GuardReviewer>
  }
/>

        {/* Rutas básicas del usuario (sin guard estricto para simplificar el pegado).
            Si quieres, puedes crear GuardRegister/GuardPanel luego. */}
        <Route path="/register" element={<RegisterUser />} />
        <Route path="/panel" element={<Panel />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    
  );
}

/* ============================
   404 simple
   ============================ */
function NotFound() {
  return (
    <div className="min-h-screen p-6 text-gray-100 bg-[#0B1220]">
      <h1 className="text-2xl font-semibold mb-2">404</h1>
      <p className="opacity-80">Página no encontrada.</p>
      <div className="mt-4">
        <a className="underline" href="/login">
          Ir a iniciar sesión
        </a>
      </div>
    </div>
  );
}
