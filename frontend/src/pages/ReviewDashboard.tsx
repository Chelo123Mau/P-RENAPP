import React from "react";

/**
 * ReviewDashboard.tsx
 * Panel de revisión con:
 *  - Lista de usuarios con rol USER (1 por fila), aprobado, entidad y nombre de entidad
 *  - Al hacer click, abre panel de detalle (formulario estilo registro + documentos descargables)
 *  - Botones: Aprobar (con validación si ya está aprobado), Generar reporte (aprobación/observaciones) con visor PDF
 *  - Canvas de comentarios (guardar en BD) + Historial de actividad
 *  - Estructura replicable para Entidades y Proyectos
 *
 * NOTA: Ajusta los endpoints si en tu backend varían.
 */

// ==========================
// Tipos de datos
// ==========================

type DetailScope = "user" | "entity" | "project";

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

type Paginated<T> = { items: T[]; meta?: { page?: number; pageSize?: number; total?: number } };

type UserListItem = {
  id: string;
  username?: string;
  email?: string;
  isApproved?: boolean;
  entityId?: string | null;
  entityName?: string | null;
  role?: string;          // "USER"
};

function fmtDate(s?: string) {
  if (!s) return "";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

type ProfileDoc = { id: string; name: string; url: string;fieldKey?: string;uploadedAt?: string };

type UserProfile = {
  email?: string;
  status?: string; // BORRADOR | ENVIADO | APROBADO | OBSERVACIONES | SOLICITUD_MOD_REGISTRO
  nombres?: string;
  apellidos?: string;
  tipoDocumento?: string;
  nroDocumento?: string;
  pais?: string;
  departamento?: string;
  ciudad?: string;
  direccion?: string;
  institucion?: string;
  cargo?: string;
  telefono?: string;
  fechaNacimiento?: string;
  data?: any;
};

const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:4000";

function absUrl(u?: string) {
  if (!u) return "#";
  return u.startsWith("http") ? u : `${API_BASE}${u}`;
}

// ==========================
// Helpers de fetch (ajusta auth/headers si es necesario)
// ==========================

async function authJson<T = any>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
      const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || sessionStorage.getItem("token")
        : null;

    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

    const r = await fetch(fullUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
      credentials: "include",
    });

    const ct = r.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");
    const payload: any = isJson ? await r.json() : undefined;

    if (r.status === 401) {
      try { localStorage.removeItem("token"); sessionStorage.removeItem("token"); } catch {}
      window.location.replace("/login");
      return { ok: false, error: "No autorizado" } as any;
    }

    if (!isJson && r.ok) {
      return { ok: false, error: `Respuesta no JSON desde ${fullUrl} (content-type: ${ct})` } as any;
    }

    // 👇 devolvemos SIEMPRE el cuerpo tal cual, para poder acceder a payload.data
    return { ok: r.ok, data: payload, error: !r.ok ? (payload?.error || r.statusText) : undefined } as any;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" } as any;
  }
}



// Genera y devuelve URL del PDF de reporte (usa tu backend existente)
async function generateReviewPdfAndSend(args: {
  scope: DetailScope;
  target: any;
  targetId: string;
  decision: "approve" | "observe";
  comments: string;
  reviewerName?: string;
}): Promise<{ url?: string }> {
  const { scope, targetId, decision, comments, reviewerName, target } = args;
  const res = await authJson<{ url: string }>(`/api/review/report`, {
    method: "POST",
    body: JSON.stringify({ scope, targetId, decision, comments, reviewerName, target }),
  });
  return { url: res.ok ? res.data?.url : undefined };
}

function prettyBool(b?: boolean | null) { return b ? "Sí" : "No"; }

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <input
        className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent"
        value={value ?? ""}
        readOnly
      />
    </div>
  );
}

export default function ReviewDashboard() {
  // Tabs (usuarios / entidades / proyectos)
  const [tab, setTab] = React.useState<"users" | "entities" | "projects">("users");

  // Estado general / mensajes
  const [msg, setMsg] = React.useState<string>("");
  const [loadError, setLoadError] = React.useState<string>("");

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    try { localStorage.removeItem("token"); sessionStorage.removeItem("token"); } catch {}
    window.location.replace("/login");
  };

  // ======== LISTAS ========
  const [users, setUsers] = React.useState<UserListItem[]>([]);
  const [meta, setMeta] = React.useState<{ page?: number; pageSize?: number; total?: number }>({ page: 1, pageSize: 20, total: 0 });

  // ======== DETALLE ========
  const [selectedScope, setSelectedScope] = React.useState<DetailScope | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Detalle usuario
  const [userDetail, setUserDetail] = React.useState<UserProfile | null>(null);
  const [userDocs, setUserDocs] = React.useState<ProfileDoc[]>([]);
  const [history, setHistory] = React.useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [reportMode, setReportMode] = React.useState<"approve" | "observe" | null>(null);
  const [alreadyApproved, setAlreadyApproved] = React.useState<boolean>(false);
  const [savingComment, setSavingComment] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");

  
  // ==========================
  // Carga de listas según tab
  // ==========================
  React.useEffect(() => {
    (async () => {
      setMsg("Cargando…");
      setLoadError("");
      try {
        if (tab === "users") {
          const qs = new URLSearchParams();
          qs.set("role", "USER");
          qs.set("page", String(meta.page || 1));
          qs.set("pageSize", String(meta.pageSize || 20));

          const r = await authJson(`/api/review/users?${qs.toString()}`);


          if (!r.ok) {
  setUsers([]);
  setLoadError(r.error || "No se pudo cargar usuarios");
} else {
  // ⚠️ IMPORTANTE: el backend responde { ok, data: { items, meta } }
  const serverData = (r.data as any)?.data;
  const items = serverData?.items ?? [];
  const serverMeta = serverData?.meta ?? meta;

  setUsers(items);
  setMeta(serverMeta);
          }
        }
      } catch (e: any) {
        setLoadError(e?.message || "Error de red");
      } finally {
        setMsg("");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, meta.page, meta.pageSize]);

  // ==========================
  // Handlers detalle de usuario
  // ==========================
  const openUserDetail = async (user: UserListItem) => {
    setSelectedScope("user");
    setSelectedId(user.id);
    setMsg("Cargando detalle…");
    try {
      const [pr, dr, hr] = await Promise.all([
        authJson<UserProfile>(`/api/users/${user.id}/profile`),
        authJson<Paginated<ProfileDoc>>(`/api/users/${user.id}/documents`),
        authJson<Paginated<any>>(`/api/review/history?scope=user&targetId=${user.id}`),
      ]);
      setUserDetail(pr.ok ? ((pr.data as any)?.data ?? pr.data ?? null) : null);
      setUserDocs(dr.ok ? (((dr.data as any)?.data?.items) ?? (dr.data as any)?.items ?? []) : []);
      setHistory(hr.ok ? (((hr.data as any)?.data?.items) ?? (hr.data as any)?.items ?? []) : []);
      setAlreadyApproved(!!user.isApproved);
      setReportMode(null);
      setPdfUrl(null);
    } finally {
      setMsg("");
    }
  };

  const approveUser = async () => {
    if (alreadyApproved) {
      alert("Este usuario ya está aprobado");
      return;
    }
    if (!selectedId) return;
    setMsg("Aprobando…");
    try {
      const r = await authJson(`/api/review/users/${selectedId}/approve`, { method: "POST" });
      if (r.ok) {
        setAlreadyApproved(true);
        const hr = await authJson<Paginated<any>>(`/api/review/history?scope=user&targetId=${selectedId}`);
        if (hr.ok) setHistory(hr.data?.items || []);
        alert("Usuario aprobado.");
      } else {
        alert(r.error || "No se pudo aprobar.");
      }
    } finally {
      setMsg("");
    }
  };

  const generateReport = async () => {
    if (!reportMode) { alert("Elige tipo de reporte"); return; }
    if (!selectedId) return;
    setMsg("Generando reporte…");
    try {
      const out = await generateReviewPdfAndSend({
        scope: "user",
        target: { id: selectedId, profile: userDetail },
        targetId: selectedId,
        decision: reportMode === "approve" ? "approve" : "observe",
        comments: newComment || "",
        reviewerName: "Revisor RENAPP",
      });
      if (out.url) setPdfUrl(out.url);
    } finally {
      setMsg("");
    }
  };

  const saveComment = async () => {
    if (!newComment.trim()) { alert("Comentario vacío"); return; }
    if (!selectedId) return;
    setSavingComment(true);
    try {
      const r = await authJson(`/api/review/comments`, {
        method: "POST",
        body: JSON.stringify({ scope: "user", targetId: selectedId, text: newComment }),
      });
      if (r.ok) {
        setNewComment("");
        const hr = await authJson<Paginated<any>>(`/api/review/history?scope=user&targetId=${selectedId}`);
        if (hr.ok) setHistory(hr.data?.items || []);
      } else {
        alert(r.error || "No se pudo guardar el comentario.");
      }
    } finally {
      setSavingComment(false);
    }
  };

  // ==========================
  // Render
  // ==========================
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab("users")}
          className={`px-3 py-1 rounded-xl ${tab === "users" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >Usuarios</button>
        <button
          onClick={() => setTab("entities")}
          className={`px-3 py-1 rounded-xl ${tab === "entities" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >Entidades</button>
        <button
          onClick={() => setTab("projects")}
          className={`px-3 py-1 rounded-xl ${tab === "projects" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >Proyectos</button>
        <div className="ml-auto flex items-center gap-2">
          {loadError ? <span className="text-xs text-red-400">{loadError}</span> : <span className="text-sm opacity-70">{msg}</span>}
          <button onClick={logout} className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500">Cerrar sesión</button>
        </div>
      </div>
      

      {/* Contenido por tab */}
      <main className="space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {loadError} <button className="ml-2 underline" onClick={() => setTab(tab)}>Reintentar</button>
          </div>
        )}
        {/* ===== TAB USUARIOS ===== */}
        {tab === "users" && (
          <>
            {users.length === 0 ? (
              <div className="text-sm opacity-70">Sin usuarios.</div>
            ) : (
              <div className="overflow-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/60">
                    <tr>
                      <th className="text-left p-3">Usuario</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Aprobado</th>
                      <th className="text-left p-3">Entidad</th>
                      <th className="text-left p-3">Nombre entidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-white/5 cursor-pointer"
                        onClick={() => openUserDetail(u)}
                      >
                        <td className="p-3">{u.username || "—"}</td>
                        <td className="p-3">{u.email || "—"}</td>
                        <td className="p-3">{prettyBool(!!u.isApproved)}</td>
                        <td className="p-3">{prettyBool(!!u.entityId)}</td>
                        <td className="p-3">{u.entityName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Panel de detalle de usuario */}
            {selectedScope === "user" && selectedId && (
              <div className="mt-6 grid gap-4">
                {/* Header con acciones */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold">
                    Usuario: {userDetail?.nombres} {userDetail?.apellidos}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button
                      className="bg-green-600 hover:bg-green-500 rounded px-3 py-1"
                      onClick={approveUser}
                    >
                      Aprobar
                    </button>

                    <div className="flex items-center gap-2">
                      <select
                        className="bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
                        value={reportMode || ""}
                        onChange={(e) => setReportMode((e.target.value as any) || null)}
                      >
                        <option value="">Generar reporte…</option>
                        <option value="approve">Aprobación</option>
                        <option value="observe">Observaciones</option>
                      </select>
                      <button
                        className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-1"
                        onClick={generateReport}
                      >
                        Generar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formulario estilo registro */}
                <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombres" value={userDetail?.nombres} />
                    <Field label="Apellidos" value={userDetail?.apellidos} />
                    <Field label="Email" value={userDetail?.email} />
                    <Field label="Teléfono" value={userDetail?.telefono} />
                    <Field label="Institución" value={userDetail?.institucion} />
                    <Field label="Cargo" value={userDetail?.cargo} />
                    <Field label="Tipo documento" value={userDetail?.tipoDocumento} />
                    <Field label="Nro documento" value={userDetail?.nroDocumento} />
                    <Field label="Fecha nacimiento" value={userDetail?.fechaNacimiento} />
                    <Field label="Dirección" value={userDetail?.direccion} />
                    <Field label="Ciudad" value={userDetail?.ciudad} />
                    <Field label="Departamento" value={userDetail?.departamento} />
                    <Field label="País" value={userDetail?.pais} />
                  </div>
                </div>

                {/* Documentos */}
                <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
                  <div className="font-semibold mb-2">Documentos</div>
                  {userDocs.length === 0 ? (
  <div className="text-sm opacity-70">Sin documentos.</div>
) : (
  <ul className="list-disc pl-5">
    {userDocs.map((d) => {
      const href = d.url?.startsWith("http") ? d.url : `${API_URL || ""}${d.url || ""}`;
      return (
        <li key={d.id} className="mb-1">
          <div className="text-xs opacity-70">
            {d.fieldKey || "—"} · {fmtDate(d.uploadedAt)}
          </div>
          <a className="text-blue-400 hover:underline" href={href} target="_blank" rel="noreferrer">
            {d.name}
          </a>
        </li>
      );
    })}
  </ul>
)}

                  
                </div>

                {/* Visor PDF (si se generó) */}
                {pdfUrl && (
                  <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
                    <div className="font-semibold mb-2">Reporte</div>
                    <div className="flex gap-2 mb-2">
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gray-800 hover:bg-gray-700 rounded px-3 py-1"
                      >
                        Abrir en nueva pestaña
                      </a>
                      <button
                        onClick={() => window.print()}
                        className="bg-gray-800 hover:bg-gray-700 rounded px-3 py-1"
                      >
                        Imprimir
                      </button>
                      <a
                        href={pdfUrl}
                        download
                        className="bg-gray-800 hover:bg-gray-700 rounded px-3 py-1"
                      >
                        Guardar
                      </a>
                    </div>
                    <iframe src={pdfUrl} className="w-full h-[70vh] rounded-xl border border-white/10" />
                  </div>
                )}

                {/* Comentarios + Guardar */}
                <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
                  <div className="font-semibold mb-2">Comentarios</div>
                  <textarea
                    className="w-full bg-gray-800 rounded p-2 text-sm"
                    rows={4}
                    placeholder="Escribe un comentario…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="mt-2">
                    <button
                      disabled={savingComment}
                      className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-1 disabled:opacity-60"
                      onClick={saveComment}
                    >
                      Guardar comentario
                    </button>
                  </div>
                </div>

                {/* Historial */}
                <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
                  <div className="font-semibold mb-2">Historial</div>
                  {history.length === 0 ? (
                    <div className="text-sm opacity-70">Sin actividad.</div>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((h, i) => (
                        <li key={i} className="text-sm">
                          <div className="opacity-70">{new Date(h.createdAt || h.date).toLocaleString()}</div>
                          <div className="font-medium">{h.action || h.title}</div>
                          {h.comments ? <div className="opacity-80">{h.comments}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== TAB ENTIDADES / PROYECTOS (estructura a replicar) ===== */}
        {tab !== "users" && (
          <div className="text-sm opacity-80">
            Esta sección usará la misma mecánica de apertura de paneles con detalle, documentos, aprobar, reporte, comentarios e historial.
            <br/>Indícame si ya tienes los endpoints listos (GET /entities, GET /projects, etc.) y lo conecto aquí de inmediato.
          </div>
        )}
      </main>
    </div>
  );
}
