import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson, authJson } from "../api"; // helper que usa VITE_API_URL
import { decideHome } from "../routeDecider"; // lógica única de rutas
import safeNav from "../utils/nav"; // evita redirecciones repetidas

export default function Login() {
  const nav = useNavigate();
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const hasNavigated = useRef(false); // evita redirigir dos veces

  // 🧭 Si ya hay token, consultar /api/auth/me y redirigir según rol/aprobación
  useEffect(() => {
    (async () => {
      if (hasNavigated.current) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const me = await authJson("/api/auth/me");
        if (me.ok && me.data) {
          const dest = decideHome(me.data);
          hasNavigated.current = true;
          safeNav(nav, dest);
        }
      } catch (err) {
        console.warn("No se pudo verificar sesión:", err);
      }
    })();
  }, [nav]);

  // 🧾 Enviar credenciales al backend
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!userInput.trim() || !password) {
      setMsg("Completa usuario y contraseña.");
      return;
    }

    try {
      const r = await apiJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userInput.trim(),   // puede ser usuario o email
          email: userInput.trim(),
          identifier: userInput.trim(),
          password,
        }),
      });

      if (!r.ok || !r.data?.token) throw new Error(r.data?.error || "Login falló");
      localStorage.setItem("token", r.data.token);

      const me = await authJson("/api/auth/me");
      const dest = decideHome(me.data || {});
      hasNavigated.current = true;
      safeNav(nav, dest);
    } catch (err: any) {
      console.error(err);
      setMsg("❌ " + (err?.message || "Error de conexión con el servidor"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1220] text-gray-100 p-6">
      <h1 className="text-3xl font-bold text-blue-400 mb-10 text-center">
        RENAPP Plataforma de prueba
      </h1>

      <div className="w-full max-w-md bg-[#111827] rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-1 text-center">Iniciar sesión</h2>
        <p className="text-sm opacity-80 mb-6 text-center">
          Ingrese su usuario o correo electrónico para continuar.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            className="bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            placeholder="Usuario o correo electrónico"
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            autoFocus
          />
          <input
            className="bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2 transition"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => nav("/signup")}
              className="flex-1 rounded-xl border border-gray-600 px-3 py-2 hover:bg-gray-700"
            >
              Crear usuario
            </button>
          </div>
        </form>

        {msg && <div className="mt-3 text-sm text-center">{msg}</div>}

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="text-xs opacity-70 hover:opacity-100 underline"
          >
            Limpiar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
