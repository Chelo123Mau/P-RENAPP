import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authJson, authFetch } from "../api";

/** Estados comunes */
type Status =
  | "borrador"
  | "enviado"
  | "aprobado"
  | "revision_final"
  | "observaciones"
  | "solicitud_mod_registro";

const statusLabel = (s?: string) =>
  s === "aprobado" ? "Aprobado" :
  s === "enviado" ? "Enviado" :
  s === "borrador" ? "Borrador" :
  s === "revision_final" ? "Revisión final enviada" :
  s === "observaciones" ? "Observado (con observaciones)" :
  s === "solicitud_mod_registro" ? "Solicitud de modificación (registro)" : (s || "-");

function mkId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

  /* ==========================
   Helper: generar PDF en servidor
   ========================== */
async function generateServerPdf({
  title,
  scope,          // "user" | "entity" | "project"
  action = "print",
  snapshot,
  setMsg,
}: {
  title: string;
  scope: "user" | "entity" | "project";
  action?: string;
  snapshot: any;
  setMsg: (s: string) => void;
}) {
  setMsg("Generando PDF en servidor…");
  try {
    // El backend guarda el PDF y crea entrada en HistoryEntry si comes 'scope' y 'action'
    const r = await authJson("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, scope, action, snapshot }),
    });
    if (!r.ok || !r.data?.pdfUrl) throw new Error(r.data?.error || `Error ${r.status}`);
    const url = r.data.pdfUrl as string;
    // Abrimos el PDF en nueva pestaña
    window.open(url, "_blank", "noopener,noreferrer");
    setMsg("✅ PDF generado y registrado en historial");
  } catch (e: any) {
    // Fallback a vista previa local si el backend falló
    setMsg("⚠️ No se pudo generar PDF en servidor. Mostrando vista previa local.");
    openPrintPreview(title, snapshot, "Vista previa local (no guardada en historial).");
  }
}


/* ==========================
   Util: ventana imprimible
   ========================== */
function openPrintPreview(title: string, payload: { [k: string]: any }, extraNote?: string) {
  const rows: string[] = [];
  const isFileArray = (val: any) =>
    Array.isArray(val) && val.length > 0 && val.every((x) => typeof x === "object" && ("name" in x || "url" in x));

  Object.keys(payload || {}).forEach((k) => {
    const v = (payload as any)[k];
    if (v == null || v === "") return;
    if (isFileArray(v)) {
      const list = (v as Array<any>).map((x) => x.name || x.url || "[archivo]").join(", ");
      rows.push(`<tr><th>${escapeHtml(prettyKey(k))}</th><td>${escapeHtml(list)}</td></tr>`);
    } else if (typeof v === "object" && !Array.isArray(v)) {
      rows.push(`<tr><th>${escapeHtml(prettyKey(k))}</th><td><pre>${escapeHtml(JSON.stringify(v, null, 2))}</pre></td></tr>`);
    } else {
      rows.push(`<tr><th>${escapeHtml(prettyKey(k))}</th><td>${escapeHtml(String(v))}</td></tr>`);
    }
  });

  const note = extraNote
    ? `<div style="margin:12px 0;padding:8px 12px;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;color:#614700;font-size:13px;">
        ${escapeHtml(extraNote)}
      </div>`
    : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; background:#0b1220; color:#e5e7eb; margin:0; padding:24px; }
  .card { background:#0f172a; border:1px solid #1f2937; border-radius:14px; padding:20px; }
  h1 { margin:0 0 12px; font-size:20px; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid #1f2937; font-size:13px; }
  th { width:280px; color:#9ca3af; font-weight:600; }
  .actions { margin-top:14px; }
  .btn { background:#2563eb; color:#fff; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; }
  @media print { .actions { display:none } body { background:#fff; color:#000 } .card { background:#fff; border: none } th,td { border-color:#e5e7eb } }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    ${note}
    <table>${rows.join("")}</table>
    <div class="actions">
      <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
  if (!win) return alert("Bloqueado por el navegador. Habilita ventanas emergentes para imprimir.");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll("\"","&quot;").replaceAll("'","&#039;");
}
function prettyKey(k: string) {
  return k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^doc/i, "Documento ")
    .replace(/^ppmPasa$/, "PPM / PASA")
    .replace(/^nit$/i, "NIT")
    .replace(/^ci$/i, "CI")
    .replace(/\bovv\b/ig, "OVV")
    .replace(/\bddmm\b/ig, "DDMM")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/* =======================================================
   Panel principal — barra a la IZQUIERDA
   ======================================================= */
export default function Panel() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"user" | "entity" | "projects" | "history">("user");
  const [msg, setMsg] = useState("");

  // ====== [PATCH] draftKey compartido para todo el Panel ======


const [draftKey, setDraftKey] = React.useState(() => {
  const k = localStorage.getItem('entityDraftKey');
  if (k) return k;
  const n = mkId();
  localStorage.setItem('entityDraftKey', n);
  return n;
});
// ====== [/PATCH] =================================================


  const onLogout = () => {
    const ok = window.confirm("¿Estás seguro de que deseas cerrar sesión?");
    if (!ok) return;
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100 grid grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* ASIDE a la izquierda */}
      <aside className="p-4 border-r border-white/10 bg-[#0F172A]">
        <h2 className="text-lg font-semibold mb-4">Mi panel</h2>
        <div className="flex flex-col gap-2">
          <DockBtn active={tab === "user"} onClick={() => setTab("user")}>Mis datos de usuario</DockBtn>
          <DockBtn active={tab === "entity"} onClick={() => setTab("entity")}>Entidad registrada</DockBtn>
          <DockBtn active={tab === "projects"} onClick={() => setTab("projects")}>Proyectos</DockBtn>
          <DockBtn active={tab === "history"} onClick={() => setTab("history")}>Historial</DockBtn>
        </div>

        <div className="mt-6">
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500"
          >
            Cerrar sesión
          </button>
          <div className="text-[11px] opacity-70 mt-1">Se pedirá confirmación.</div>
        </div>

        {msg && <div className="text-xs mt-4 p-2 rounded bg-black/30">{msg}</div>}
      </aside>

      {/* CONTENIDO */}
      <main className="p-6">
        {tab === "user" && <UserDataSection draftKey={draftKey} setMsg={setMsg}/>}
        {tab === "entity" && <EntitySection draftKey={draftKey} setDraftKey={setDraftKey} setMsg={setMsg} />}
        {tab === "projects" && <ProjectsSection draftKey={draftKey} setDraftKey={setDraftKey} setMsg={setMsg}/>}
        {tab === "history" && <HistorySection draftKey={draftKey} setMsg={setMsg}/>}
      </main>
    </div>
  );
}

function DockBtn({ active, onClick, children }:{
  active?: boolean; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl transition
        ${active ? "bg-blue-600/80 text-white" : "bg-gray-800 hover:bg-gray-700"}`}
    >
      {children}
    </button>
  );
}

/* =======================================================
   Sección: Mis datos de usuario (mostrar todo + imprimir + solicitar modificación)
   ======================================================= */
function UserDataSection({ setMsg }:{ setMsg: (m:string)=>void }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("aprobado"); // en este panel asumimos aprobado
  const [form, setForm] = useState<any>({});   // carga TODOS los campos y adjuntos

  useEffect(() => {
    (async () => {
      setMsg("Cargando datos de usuario…");
      try {
        const sent = await authJson("/api/register/user");
        if (sent.ok && sent.data) {
          setForm(sent.data);
          setStatus((sent.data.status as Status) || "aprobado");
        } else {
          const draft = await authJson("/api/register/user/draft");
          if (draft.ok && draft.data?.data) setForm(draft.data.data);
          setStatus("borrador");
        }
      } catch {}
      setLoading(false);
      setMsg("");
    })();
  }, [setMsg]);

 const printUser = async () => {
  await generateServerPdf({
    title: "Registro de Usuario — Reporte",
    scope: "user",
    action: "print",
    snapshot: form,
    setMsg,
  });
};

  const requestChange = async () => {
    const ok = window.confirm(
      "Se solicitará la modificación de la información enviada, esto se aprobará por un revisor y se lo notificará una vez aprobado.\n\n¿Desea continuar?"
    );
    if (!ok) return;
    setMsg("Enviando solicitud de modificación…");
    try {
      const r = await authJson("/api/register/user/request-change", { method: "POST" });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setStatus("solicitud_mod_registro");
      setMsg("✅ Solicitud enviada. Un revisor la evaluará.");
      // Guardar en historial
      await authJson("/api/history/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "user", action: "request-change", snapshot: form, title: "Solicitud de modificación de registro" }),
      });
    } catch (e:any) {
      setMsg("❌ " + (e?.message || "No se pudo solicitar la modificación"));
    }
  };

  if (loading) return <div>Cargando…</div>;

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Mis datos de usuario</h1>

      <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4 grid gap-3">
        <div className="text-sm opacity-80">Estado: {statusLabel(status)}</div>

        {/* Render dinámico de TODOS los campos */}
        <div className="grid gap-2">
          {Object.keys(form || {}).length === 0 && (
            <div className="text-sm opacity-70">No hay datos de registro aún.</div>
          )}
          {Object.entries(form || {}).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[220px_1fr] gap-2 text-sm">
              <div className="opacity-70">{prettyKey(k)}</div>
              <div>
                {Array.isArray(v) && v.length && typeof v[0] === "object" && ("name" in v[0] || "url" in v[0]) ? (
                  <ul className="list-disc list-inside">
                    {v.map((f:any, idx:number) => <li key={idx}>{f.name || f.url || "[archivo]"}</li>)}
                  </ul>
                ) : typeof v === "object" && v !== null ? (
                  <pre className="bg-black/30 rounded p-2 overflow-auto">{JSON.stringify(v, null, 2)}</pre>
                ) : (
                  <span>{String(v)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={printUser} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2">
            Imprimir / Guardar PDF
          </button>
          <button onClick={requestChange} className="bg-yellow-600 hover:bg-yellow-500 rounded-xl px-4 py-2">
            Solicitar modificaciones de registro
          </button>
        </div>
      </div>
    </section>
  );
}



/* =======================================================
   Sección: Entidad registrada (1 por usuario) + imprimir + solicitar modificación
   ======================================================= */
function EntitySection({
  setMsg,
  draftKey,
  setDraftKey,
}: {
  setMsg: (m: string) => void;
  draftKey: string;
  setDraftKey: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<any | null>(null);
  const [status, setStatus] = useState<Status>("borrador");

  const [form, setForm] = useState<any>({
    nombreInstitucion: "", direccion: "", telefono: "", correo: "", web: "",
    tipoEntidad: "", fechaConstitucion: "", municipioConstitucion: "",
    representanteLegal: "", numeroComercial: "", nit: "",
    nacionalOExtranjera: "nacional",
    docDenominacion: [], docConstitucion: [], docPoderNotariado: [], docRegistroComercial: [], docNIT: [], docExtranjera: [],
  });
  const onChange = (k:string, v:any) => setForm((f:any)=>({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      setMsg("Cargando entidad…");
      try {
        const r = await authJson("/api/entities/mine");
        if (r.ok && Array.isArray(r.data) && r.data.length) {
          setEntity(r.data[0]);
          setStatus(r.data[0].status || "enviado");
        }
      } catch {}
      setLoading(false);
      setMsg("");
    })();
  }, [setMsg]);

  const saveDraft = async () => {
    setMsg("Guardando borrador de entidad…");
    try {
      const r = await authJson("/api/entities/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form }),
      });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setMsg("✅ Borrador guardado");
    } catch (e:any) { setMsg("❌ " + (e?.message || "No se pudo guardar")); }
  };

  const submitEntity = async () => {
  if (!window.confirm("¿Enviar formulario de entidad?")) return;
  setMsg("Enviando entidad…");
  try {
    const payload = {
      // usa "name" si tu backend espera "name"; si espera "nombre", cambia la clave aquí
      name: form.nombreInstitucion?.trim(),
      data: form,
      draftKey, // 👈 CLAVE: el puente para reasignar los archivos
    };

    if (!payload.name) {
      setMsg("❌ Debe completar el nombre de la entidad");
      return;
    }

    const r = await authJson("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);

    setEntity(r.data);
    setStatus("enviado");
    setMsg("✅ Enviado para revisión");

    // historial (igual que tenías)
    await authJson("/api/history/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "entity",
        action: "submit",
        snapshot: form,
        title: "Envío de entidad",
      }),
    });

    // 👇 Limpia el draftKey y crea uno nuevo por si arranca otra entidad
    localStorage.removeItem("entityDraftKey");
    const next = mkId();
    localStorage.setItem("entityDraftKey", next);
    setDraftKey(next);
  } catch (e: any) {
    setMsg("❌ " + (e?.message || "No se pudo enviar"));
  }
};


 const printEntity = async () => {
  const data = entity ? (entity.data || entity) : form;
  await generateServerPdf({
    title: "Registro de Entidad — Reporte",
    scope: "entity",
    action: "print",
    snapshot: data,
    setMsg,
  });
};


  const requestChangeEntity = async () => {
    const ok = window.confirm(
      "Se solicitará la modificación de este formulario. Un revisor deberá aprobar la solicitud y se le notificará cuando sea posible editar.\n\n¿Desea continuar?"
    );
    if (!ok) return;
    setMsg("Enviando solicitud de modificación…");
    try {
      const id = entity?.id;
      const r = await authJson(`/api/entities/${id}/request-change`, { method: "POST" });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setMsg("✅ Solicitud enviada");
      await authJson("/api/history/add", { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ scope:"entity", action:"request-change", snapshot: entity?.data || form, title:"Solicitud de modificación — Entidad" }) });
    } catch (e:any) { setMsg("❌ " + (e?.message || "No se pudo solicitar")); }
  };

  if (loading) return <div>Cargando…</div>;

  // Si ya entidad:
  if (entity) {
    const est = (entity.status || status) as Status;
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Entidad registrada</h1>
        <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4 grid gap-3">
          <div className="text-lg font-semibold">{entity.name || entity.data?.nombreInstitucion}</div>
          <div className="text-sm opacity-80">Estado: {statusLabel(est)}</div>

          <div className="flex gap-2 pt-1">
            <button onClick={printEntity} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2">
              Imprimir / Guardar PDF
            </button>
            {est === "aprobado" ? (
              <button onClick={requestChangeEntity} className="bg-yellow-600 hover:bg-yellow-500 rounded-xl px-4 py-2">
                Solicitar modificaciones
              </button>
            ) : est === "observaciones" ? (
              <div className="text-sm px-3 py-2 rounded-xl bg-yellow-800/30 text-yellow-200">
                Formulario observado. Corrige y vuelve a enviar desde este panel.
              </div>
            ) : (
              <div className="text-sm opacity-70 self-center">En revisión.</div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Si NO aún: formulario con imprimir/guardar/enviar
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Registrar entidad</h1>
      <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <TextInput label="Nombre legal de la institución" value={form.nombreInstitucion} onChange={(v)=>onChange("nombreInstitucion", v)} />
          <TextInput label="Correo institucional" value={form.correo} onChange={(v)=>onChange("correo", v)} />
          <TextInput label="Teléfono institucional" value={form.telefono} onChange={(v)=>onChange("telefono", v)} />
          <TextInput label="Página web" value={form.web} onChange={(v)=>onChange("web", v)} />
          <TextInput label="Dirección física" value={form.direccion} onChange={(v)=>onChange("direccion", v)} />
          <Select label="Tipo de entidad" value={form.tipoEntidad} onChange={(v)=>onChange("tipoEntidad", v)}
            options={["Ministerio", "Institución pública", "ONG", "Empresa privada", "Otra"]}/>
          <TextInput label="Fecha de constitución (AAAA-MM-DD)" value={form.fechaConstitucion} onChange={(v)=>onChange("fechaConstitucion", v)} />
          <TextInput label="Municipio de constitución" value={form.municipioConstitucion} onChange={(v)=>onChange("municipioConstitucion", v)} />
          <TextInput label="Representante legal" value={form.representanteLegal} onChange={(v)=>onChange("representanteLegal", v)} />
          <TextInput label="Número comercial / Matrícula (FUNDEMPRESA)" value={form.numeroComercial} onChange={(v)=>onChange("numeroComercial", v)} />
          <TextInput label="NIT" value={form.nit} onChange={(v)=>onChange("nit", v)} />
          <Select label="Carácter" value={form.nacionalOExtranjera} onChange={(v)=>onChange("nacionalOExtranjera", v)} options={["nacional","extranjera"]}/>
        </div>

        {/* Adjuntos */}
        <div className="grid md:grid-cols-2 gap-4">
          <FileUpload label="Documento legal que respalde la denominación" fieldKey="docDenominacion" draftKey={draftKey} onUploaded={(files)=>onChange("docDenominacion", [...form.docDenominacion, ...files])} />
          <FileUpload label="Documento de constitución o acta notariada" fieldKey="docConstitucion" draftKey={draftKey} onUploaded={(files)=>onChange("docConstitucion", [...form.docConstitucion, ...files])} />
          <FileUpload label="Poder notariado / Acta de designación" fieldKey="docPoderNotariado" draftKey={draftKey} onUploaded={(files)=>onChange("docPoderNotariado", [...form.docPoderNotariado, ...files])} />
          <FileUpload label="Certificado de registro comercial (FUNDEMPRESA)" fieldKey="docRegistroComercial" draftKey={draftKey} onUploaded={(files)=>onChange("docRegistroComercial", [...form.docRegistroComercial, ...files])} />
          <FileUpload label="Copia del NIT" fieldKey="docNIT" draftKey={draftKey} onUploaded={(files)=>onChange("docNIT", [...form.docNIT, ...files])} />
          {form.nacionalOExtranjera === "extranjera" && (
          <FileUpload label="Constitución en el país (si extranjera)" fieldKey="docExtranjera" draftKey={draftKey} onUploaded={(files)=>onChange("docExtranjera", [...form.docExtranjera, ...files])} />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={() => generateServerPdf({title: "Registro de Entidad — Reporte (borrador)", scope: "entity",
           action: "print",
           snapshot: form,
            setMsg,
           })}
           className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2"
>
           Imprimir / Guardar PDF
          </button>

          <button onClick={saveDraft} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2">Guardar borrador</button>
          <button onClick={submitEntity} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2">Enviar formulario</button>
        </div>
      </div>
    </section>
  );
}

/* =======================================================
   Sección: Proyectos / Programas + imprimir + solicitar modificación
   ======================================================= */
function ProjectsSection({
  draftKey,
  setDraftKey,
  setMsg,
}: {
  draftKey: string;
  setDraftKey: React.Dispatch<React.SetStateAction<string>>;
  setMsg: (m: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [entityExists, setEntityExists] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [form, setForm] = useState<any>({
    titularMedida: "", representanteLegal: "", numeroIdentidad: "",
    numeroDocNotariado: "", nombreProyecto: "", modeloMercado: "",
    areaProyecto: "",
    docTitularidad: [], docPoderNotariado: [], docIdentidad: [], docLicenciaAmbiental: [],
    docDDMM_OVV: [], docReporteValidacion: [], docActasConsultas: [], docMapaCroquis: [],
    ppmPasa: [],
  });
  const onChange = (k:string, v:any) => setForm((f:any)=>({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      setMsg("Cargando proyectos…");
      try {
        const e = await authJson("/api/entities/mine");
        setEntityExists(Boolean(e.ok && Array.isArray(e.data) && e.data.length));
        const r = await authJson("/api/projects/mine");
        if (r.ok) setItems(Array.isArray(r.data) ? r.data : (r.data?.items || []));
      } catch {}
      setLoading(false); setMsg("");
    })();
  }, [setMsg]);

  const saveDraft = async () => {
    setMsg("Guardando borrador de proyecto…");
    try {
      const r = await authJson("/api/projects/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form }),
      });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setMsg("✅ Borrador guardado");
    } catch (e:any) { setMsg("❌ " + (e?.message || "No se pudo guardar")); }
  };

  const submitProject = async () => {
    if (!entityExists) { setMsg("Primero debes registrar una entidad."); return; }
    if (!window.confirm("¿Enviar formulario de proyecto?")) return;
    setMsg("Enviando proyecto…");
    try {
      const r = await authJson("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  title: form.nombreProyecto,
  summary: form.modeloMercado,
  data: form,
  draftKey,                // 👈 igual que en entidades
}),
      });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setItems((prev)=>[...(prev||[]), r.data]);
      setForm((f:any)=>({ ...f, nombreProyecto:"", modeloMercado:"" }));
      setStatusMsg("✅ Enviado para revisión");
      await authJson("/api/history/add", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ scope:"project", action:"submit", snapshot: form, title:"Envío de proyecto" }) });

    

    } catch (e:any) { setStatusMsg("❌ " + (e?.message || "No se pudo enviar")); }
    finally { setMsg(""); }

    localStorage.removeItem("entityDraftKey");
    const next = mkId();
    localStorage.setItem("entityDraftKey", next);
    setDraftKey(next);
  };

  
 const printProjectDraft = async () => {
  await generateServerPdf({
    title: "Proyecto — Reporte (borrador)",
    scope: "project",
    action: "print",
    snapshot: form,
    setMsg,
  });
};


  const requestChangeProject = async (id: string, snapshot: any) => {
    const ok = window.confirm(
      "Se solicitará la modificación de este proyecto. Un revisor deberá aprobar la solicitud y se le notificará cuando sea posible editar.\n\n¿Desea continuar?"
    );
    if (!ok) return;
    setMsg("Solicitando modificación…");
    try {
      const r = await authJson(`/api/projects/${id}/request-change`, { method: "POST" });
      if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
      setMsg("✅ Solicitud enviada");
      await authJson("/api/history/add", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ scope:"project", action:"request-change", snapshot, title:"Solicitud de modificación — Proyecto" }) });
    } catch (e:any) { setMsg("❌ " + (e?.message || "No se pudo solicitar")); }
  };

  const printProjectSubmitted = async (p:any) => {
  await generateServerPdf({
    title: `Proyecto — Reporte (${p.title || p.nombreProyecto || "enviado"})`,
    scope: "project",
    action: "print",
    snapshot: p.data || p,
    setMsg,
  });
};


  if (loading) return <div>Cargando…</div>;

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Proyectos / Programas</h1>

      {!entityExists && (
        <div className="mb-4 p-3 rounded-xl bg-yellow-800/30 text-yellow-200">
          Para registrar proyectos, primero debes <b>registrar una entidad</b>.
        </div>
      )}

      {/* Formulario para nuevo proyecto */}
      <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-4 mb-6 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <TextInput label="Titular de la medida de mitigación" value={form.titularMedida} onChange={(v)=>onChange("titularMedida", v)} />
          <TextInput label="Representante legal" value={form.representanteLegal} onChange={(v)=>onChange("representanteLegal", v)} />
          <TextInput label="Número de identidad (CI)" value={form.numeroIdentidad} onChange={(v)=>onChange("numeroIdentidad", v)} />
          <TextInput label="Nº documento notariado de representación" value={form.numeroDocNotariado} onChange={(v)=>onChange("numeroDocNotariado", v)} />
          <TextInput label="Nombre del programa/proyecto" value={form.nombreProyecto} onChange={(v)=>onChange("nombreProyecto", v)} />
          <Select label="Modelo de mercado" value={form.modeloMercado} onChange={(v)=>onChange("modeloMercado", v)}
            options={["Voluntario","Cumplimiento","Bilateral (Art. 6.2)","Mecanismo (Art. 6.4)","Otro"]}/>
          <TextInput label="Área del proyecto (depto/municipio/coord/superficie)" value={form.areaProyecto} onChange={(v)=>onChange("areaProyecto", v)} />
        </div>

        {/* Adjuntos requeridos */}
        <div className="grid md:grid-cols-2 gap-4">
  <FileUpload
    label="Documento de titularidad / resolución"
    fieldKey="docTitularidad"            // 👈 clave interna
    draftKey={draftKey}
    docType="PROYECTO"                  // 👈 igual que entidades
    onUploaded={(f)=>onChange("docTitularidad", [...form.docTitularidad, ...f])}
  />
  <FileUpload
    label="Poder notariado (representación legal)"
    fieldKey="docPoderNotariado"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docPoderNotariado", [...form.docPoderNotariado, ...f])}
  />
  <FileUpload
    label="Copia de CI del representante"
    fieldKey="docIdentidad"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docIdentidad", [...form.docIdentidad, ...f])}
  />
  <FileUpload
    label="Copia de licencia ambiental (si aplica)"
    fieldKey="docLicenciaAmbiental"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docLicenciaAmbiental", [...form.docLicenciaAmbiental, ...f])}
  />
  <FileUpload
    label="DDMM aprobado por OVV"
    fieldKey="docDDMM_OVV"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docDDMM_OVV", [...form.docDDMM_OVV, ...f])}
  />
  <FileUpload
    label="Reporte de validación del OVV"
    fieldKey="docReporteValidacion"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docReporteValidacion", [...form.docReporteValidacion, ...f])}
  />
  <FileUpload
    label="Actas y documentación de consultas"
    fieldKey="docActasConsultas"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docActasConsultas", [...form.docActasConsultas, ...f])}
  />
  <FileUpload
    label="Mapa o croquis de localización"
    fieldKey="docMapaCroquis"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("docMapaCroquis", [...form.docMapaCroquis, ...f])}
  />
  <FileUpload
    label="PPM / PASA"
    fieldKey="ppmPasa"
    draftKey={draftKey}
    docType="PROYECTO"
    onUploaded={(f)=>onChange("ppmPasa", [...form.ppmPasa, ...f])}
  />
</div>


        <div className="flex gap-2 pt-2">
          <button onClick={printProjectDraft} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2" disabled={!entityExists}>
            Imprimir / Guardar PDF
          </button>
          <button onClick={saveDraft} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2" disabled={!entityExists}>
            Guardar borrador
          </button>
          <button onClick={submitProject} className={`rounded-xl px-4 py-2 ${entityExists ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700 cursor-not-allowed"}`} disabled={!entityExists}>
            Enviar formulario
          </button>
        </div>

        {statusMsg && <div className="text-sm mt-2">{statusMsg}</div>}
      </div>

      {/* Listado de mis proyectos */}
      <div className="grid gap-3">
        {(!items || items.length === 0) ? (
          <div>No hay proyectos aún.</div>
        ) : items.map((p:any) => {
          const est: Status = (p.status || "enviado") as Status;
          return (
            <div key={p.id} className="bg-[#0F172A] rounded-2xl border border-white/10 p-4">
              <div className="font-semibold">{p.title || p.nombreProyecto}</div>
              <div className="text-xs opacity-70 mt-1">Estado: {statusLabel(est)}</div>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>printProjectSubmitted(p)} className="bg-gray-700 hover:bg-gray-600 rounded-xl px-3 py-1 text-sm">
                  Imprimir / Guardar PDF
                </button>
                {est === "aprobado" ? (
                  <button
                    onClick={()=>requestChangeProject(p.id, p.data || p)}
                    className="bg-yellow-600 hover:bg-yellow-500 rounded-xl px-3 py-1 text-sm"
                  >
                    Solicitar modificaciones
                  </button>
                ) : est === "observaciones" ? (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-800/30 text-yellow-200 self-center">
                    Observado: corrige y reenvía
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =======================================================
   Sección: Historial (solicitudes y respuestas del revisor)
   ======================================================= */
function HistorySection({ setMsg }:{ setMsg: (m:string)=>void }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]); // informes del revisor

  useEffect(() => {
    (async () => {
      setMsg("Cargando historial…");
      try {
        const h = await authJson("/api/history/mine");
        if (h.ok) setHistory(h.data?.items || h.data || []);
      } catch {
        setHistory([{ id: "warn", title: "(endpoint no implementado)", createdAt: new Date().toISOString() }]);
      }
      try {
        const i = await authJson("/api/inbox"); // informes de revisión dirigidos al usuario
        if (i.ok) setInbox(i.data?.items || i.data || []);
      } catch {
        // opcional: bandeja aún no implementada
      }
      setLoading(false);
      setMsg("");
    })();
  }, [setMsg]);

  if (loading) return <div>Cargando…</div>;

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Historial de solicitudes</h1>
        {(!history || history.length === 0) ? (
          <div className="text-sm opacity-70">Aún no hay entradas en tu historial.</div>
        ) : (
          <div className="grid gap-2">
            {history.map((it:any) => (
              <div key={it.id || Math.random()} className="bg-[#0F172A] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{it.title || it.action || "Entrada"}</div>
                  <div className="opacity-70">
                    {(it.scope || "").toUpperCase()} · {new Date(it.createdAt || Date.now()).toLocaleString()}
                    {it.status ? ` · Estado: ${statusLabel(it.status)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {it.pdfUrl ? (
                    <a href={it.pdfUrl} target="_blank" rel="noreferrer" className="bg-gray-700 hover:bg-gray-600 rounded-xl px-3 py-1 text-sm">Ver PDF</a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Informes del revisor</h2>
        {(!inbox || inbox.length === 0) ? (
          <div className="text-sm opacity-70">No hay informes del revisor por el momento.</div>
        ) : (
          <div className="grid gap-2">
            {inbox.map((r:any) => (
              <div key={r.id || Math.random()} className="bg-[#0F172A] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{r.title || "Informe de revisión"}</div>
                  <div className="opacity-70">
                    {r.type || r.scope} · {(r.status ? statusLabel(r.status) : "—")} · {new Date(r.createdAt || Date.now()).toLocaleString()}
                  </div>
                  {r.comments ? <div className="mt-1 text-xs opacity-80">Comentarios: {r.comments}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  {r.pdfUrl ? <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="bg-gray-700 hover:bg-gray-600 rounded-xl px-3 py-1 text-sm">Ver PDF</a> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* =============================
   Inputs básicos reutilizables
   ============================= */
function TextInput({ label, value, onChange, disabled }:{
  label: string; value: any; onChange: (v:string)=>void; disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm opacity-80 mb-1">{label}</div>
      <input
        className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500 disabled:opacity-60"
        value={value ?? ""} onChange={(e)=>onChange(e.target.value)} disabled={disabled}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }:{
  label: string; value: string; onChange: (v:string)=>void; options: string[];
}) {
  return (
    <label className="block">
      <div className="text-sm opacity-80 mb-1">{label}</div>
      <select
        className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
        value={value} onChange={(e)=>onChange(e.target.value)}
      >
        <option value="">Seleccione…</option>
        {options.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    </label>
  );
}

/* ==========================================
   Subida de archivos (/api/upload, campo "files")
   ========================================== */

function getToken(): string | null {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function FileUpload({
  label,
  fieldKey, draftKey,
  docType,
  onUploaded,
  multiple = true,
}: {
  label: string;
  fieldKey: string;
  draftKey: string;
  docType?: "USUARIO" | "ENTIDAD" | "PROYECTO";
  onUploaded: (items: Array<{ name: string; url: string; mime?: string; size?: number }>) => void;
  multiple?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [uploadedNames, setUploadedNames] = React.useState<string[]>([]); // 👈 nombres mostrados al lado del botón
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";

  const pick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const fd = new FormData();
    Array.from(e.target.files).forEach((f) => fd.append("files", f));
    fd.append("fieldKey", fieldKey);
    fd.append("draftKey", draftKey);
    if (docType && docType.trim() !== "") {
    fd.append("docType", docType.trim().toUpperCase());} //;
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo subir archivo(s)");

      const items: Array<{ name?: string; originalName?: string; url: string }> = Array.isArray(data?.files) ? data.files : [];

      // Actualiza lista visual con nombres (prefiere name, luego originalName)
      const newNames = items.map((it) => it.name || it.originalName || "archivo");
      setUploadedNames((prev) => [...prev, ...newNames]);

      // Propaga a estado padre
      onUploaded(items as any);
    } catch (err: any) {
      alert("No se pudo subir archivo(s): " + (err?.message || "Error"));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <div className="text-sm opacity-80">{label}</div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl px-3 py-2"
        >
          {busy ? "Subiendo..." : "Seleccionar archivo(s)"}
        </button>
        {/* 👇 Nombres al lado del botón */}
        {uploadedNames.length > 0 && (
          <div className="text-xs opacity-80 flex gap-2 flex-wrap">
            {uploadedNames.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="px-2 py-1 bg-gray-800 rounded-lg border border-gray-700"
                title={n}
              >
                {n}
              </span>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          onChange={onChange}
          type="file"
          hidden
          multiple={multiple}
        />
      </div>
    </div>
  );
}
