import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { authFetch, authJson } from "../api";

export default function ReviewReport() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const type = params.get("type") || "users";       // users | entities | projects
  const id = params.get("id") || "";
  const action = params.get("action") || "approve";  // approve | observe

  const [mailTo, setMailTo] = useState("");
  const [msg, setMsg] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);

  // PDF URL desde backend
  const pdfUrl = useMemo(() => {
    // Tu backend debe servir el PDF listo para ver/descargar/imprimir
    return `${import.meta.env.VITE_API_URL}/api/review/report/${type}/${id}.pdf?action=${action}`;
  }, [type, id, action]);

  useEffect(() => {
    const saved = sessionStorage.getItem("reviewComments");
    if (saved) {
      setMsg(`Comentarios enviados: ${saved}`);
      // Si quieres, limpia:
      // sessionStorage.removeItem("reviewComments");
    }
  }, []);

  const sendEmail = async () => {
    if (!mailTo.trim()) return alert("Escribe un correo de destino");
    try {
      const r = await authJson(`/api/review/report/${type}/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: mailTo }),
      });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      alert("✅ Reporte enviado por correo");
    } catch (e: any) {
      alert("❌ No se pudo enviar: " + (e?.message || "Error"));
    }
  };

  const doPrint = () => {
    // Abre el PDF en una nueva pestaña para imprimir
    window.open(pdfUrl, "_blank", "noopener");
  };

  const doDownload = async () => {
    // Descarga directa del PDF
    const res = await authFetch(`/api/review/report/${type}/${id}.pdf?action=${action}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${type}-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6">
      <h1 className="text-2xl font-semibold mb-1">Informe {action === "approve" ? "de aprobación" : "con observaciones"}</h1>
      <div className="opacity-80 mb-4">
        {type} · {id}
      </div>

      {msg && <div className="mb-4 text-xs p-2 rounded bg-black/30">{msg}</div>}

      <div className="mb-4 flex gap-2 items-center">
        <input
          className="bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
          placeholder="Correo destino (opcional)"
          value={mailTo}
          onChange={(e) => setMailTo(e.target.value)}
        />
        <button onClick={sendEmail} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2">
          Enviar por mail
        </button>
        <button onClick={doDownload} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2">
          Descargar
        </button>
        <button onClick={doPrint} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2">
          Imprimir
        </button>
      </div>

      <div className="bg-[#0F172A] rounded-2xl border border-white/10">
        {/* Preview en iframe (si tu servidor pone cabeceras correctas, se previsualiza) */}
        <iframe ref={frameRef} src={pdfUrl} title="Reporte PDF" className="w-full h-[80vh]" />
      </div>
    </div>
  );
}
