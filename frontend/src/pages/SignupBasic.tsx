import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../api"; // asegúrate de tener este helper

export default function SignupBasic() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const validate = () => {
    if (!username.trim()) return "El nombre de usuario es obligatorio";
    if (!email.trim()) return "El correo electrónico es obligatorio";
    if (!/\S+@\S+\.\S+/.test(email)) return "El correo electrónico no es válido";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
    if (password !== confirmPassword) return "Las contraseñas no coinciden";
    return "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const v = validate();
    if (v) return setMsg(v);

    try {
      setLoading(true);
      const r = await apiJson("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);

      const token = r.data?.token;
      if (token) localStorage.setItem("token", token);

      setMsg("✅ Usuario creado con éxito");
      // Ir al formulario completo (RegisterUser)
      nav("/register", { replace: true });
    } catch (err: any) {
      setMsg("❌ " + (err?.message || "Error al crear usuario"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100 flex items-center justify-center">
      <form
        onSubmit={submit}
        className="bg-[#0F172A] p-6 rounded-2xl border border-white/10 w-full max-w-md"
      >
        <h1 className="text-2xl font-semibold mb-4">Crear cuenta</h1>

        <label className="block mb-3">
          <div className="text-sm opacity-80 mb-1">Nombre de usuario</div>
          <input
            type="text"
            className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block mb-3">
          <div className="text-sm opacity-80 mb-1">Correo electrónico</div>
          <input
            type="email"
            className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block mb-3">
          <div className="text-sm opacity-80 mb-1">Contraseña</div>
          <input
            type="password"
            className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block mb-4">
          <div className="text-sm opacity-80 mb-1">Confirmar contraseña</div>
          <input
            type="password"
            className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2 font-semibold"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        {msg && <div className="mt-3 text-sm">{msg}</div>}

        <div className="mt-4 text-sm opacity-70 text-center">
          ¿Ya tienes cuenta?{" "}
          <span
            className="text-blue-400 cursor-pointer hover:underline"
            onClick={() => nav("/login")}
          >
            Inicia sesión
          </span>
        </div>
      </form>
    </div>
  );
}
