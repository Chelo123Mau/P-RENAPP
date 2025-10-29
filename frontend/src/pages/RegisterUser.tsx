import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { SectionTitle, Field, UploadPerField } from '../components/FormPieces';

type Archivo = {
id: string;
name: string;
url: string;
size: number;
mime: string;
fieldKey: string;
docType: "USUARIO"|"ENTIDAD"|"PROYECTO"|"OVV"|"ESTANDAR"|"METODOLOGIA"; 
draftKey?: string | null;
};

function getToken(): string | null {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function authHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra || {});
  const t = getToken();
  if (t) h.set('Authorization', `Bearer ${t}`);
  return h;
}
const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";

async function authJson(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

// uploadFiles sube archivos y devuelve metadatos
async function uploadFiles(
  files: FileList | File[],
  fieldKey: string,
  opts?: { docType?: "USUARIO"|"ENTIDAD"|"PROYECTO"|"OVV"|"ESTANDAR"|"METODOLOGIA"; draftKey?: string }
): Promise<Archivo[]> {
  const fd = new FormData();
  Array.from(files as any).forEach((f: File) => fd.append("files", f)); // Multer espera "files"
  fd.append("fieldKey", fieldKey);

  // En RegisterUser NO mandamos docType → Prisma aplica default USUARIO
  // (pero dejamos la opción para futuros formularios)
  if (opts?.docType && opts.docType.trim() !== "") {
    fd.append("docType", opts.docType.trim().toUpperCase());
  }
  if (opts?.draftKey && opts.draftKey.trim() !== "") {
    fd.append("draftKey", opts.draftKey.trim());
  }

  const token = getToken();
  const r = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  if (!r.ok) {
    let msg = `Error subiendo archivos (${r.status})`;
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  const json = await r.json();
  return Array.isArray(json?.files) ? json.files as Archivo[] : [];
}






export default function RegisterUser() {
  const nav = useNavigate();
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({
    nombres: '', apellidos: '', email: '', telefono: '', fechaNacimiento: '',
    ci: '', cargoRelacion: '', entidadRepresenta: '', domicilio: '',
    correoInstitucional: '', departamento: '', ciudad: '',
    docAcreditacion: '', // texto opcional
  });


// Cargar borrador guardado del backend al iniciar
useEffect(() => {
  (async () => {
    const token = getToken();
    if (!token) { nav("/login", { replace: true }); return; }

    // 1) ¿Aprobado? si sí → panel de usuario
    const me = await authJson("/api/auth/me");
    if (me.ok) {
      const { isApproved } = me.data || {};
      if (isApproved) { nav("/panel", { replace: true }); return; }
    }

    // 2) Cargar borrador (si )
    const d = await authJson("/api/register/user/draft"); // backend responde { data: {...} } o {}
    const draft = d.ok ? (d.data?.data || {}) : {};

    // 3) Cargar snapshot enviado (si ya lo envió antes) — útil para re-editar en observaciones
    const s = await authJson("/api/register/user"); // backend devuelve { ...campos..., status }
    const snap = s.ok ? (s.data || {}) : {};
    const status = s.ok ? (s.data?.status || "") : "";

    // Preferencia: si hay snapshot (ya enviado), lo mostramos; si no, borrador.
    const source: any = Object.keys(snap).length ? snap : draft;

    setF((prev) => ({
      ...prev,
      nombres: source.nombres ?? prev.nombres,
      apellidos: source.apellidos ?? prev.apellidos,
      email: source.email ?? prev.email,
      telefono: source.telefono ?? prev.telefono,
      fechaNacimiento: source.fechaNacimiento ?? prev.fechaNacimiento,
      ci: source.nroDocumento ?? source.ci ?? prev.ci,
      cargoRelacion: source.cargoRelacion ?? source.cargo ?? prev.cargoRelacion,
      entidadRepresenta: source.entidadRepresenta ?? source.institucion ?? prev.entidadRepresenta,
      domicilio: source.direccion ?? prev.domicilio,
      departamento: source.departamento ?? prev.departamento,
      ciudad: source.ciudad ?? prev.ciudad,
      correoInstitucional: source.correoInstitucional ?? prev.correoInstitucional,
      docAcreditacion: source.docAcreditacion ?? prev.docAcreditacion,
    }));

    // Si guardaste arrays en draft/data:
    if (Array.isArray(source.documentos)) setDocs(source.documentos as Archivo[]);
    if (source.docsPorCampo && typeof source.docsPorCampo === "object") {
      setDocsPorCampo(source.docsPorCampo);
    }

    // (Opcional) puedes mostrar el estado textual:
    if (status) setMsg(`Estado actual: ${status}`);
  })();
}, []);

function setField<K extends keyof typeof f>(name: K, value: (typeof f)[K]) {
  setF((prev) => ({ ...prev, [name]: value }));
}


  const [docs, setDocs] = useState<Archivo[]>([]); // adjuntos generales
  const [docsPorCampo, setDocsPorCampo] = useState<Record<string, Archivo[]>>({});

  const handleUploadPerField = async (key: string, files: FileList) => {
  try {
    setMsg(`Subiendo ${key}...`);
    const ups = await uploadFiles(files, key); // 👈 SIN docType aquí
    setDocsPorCampo((prev) => ({ ...prev, [key]: [ ...(prev[key] || []), ...ups ] }));
    setMsg(`✅ ${key} subido`);
  } catch (err: any) {
    setMsg("❌ " + (err?.message || `Error subiendo ${key}`));
  }
};

  

 const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMsg("");

  // 🟡 Ventana de confirmación antes de enviar
  const confirmar = window.confirm(
    "Se enviará el formulario para su revisión.\n" +
    "Una vez enviado, no podrá modificar los datos hasta que un revisor lo apruebe.\n\n" +
    "Será redirigido a la página de ingreso (login).\n\n¿Desea continuar?"
  );
  if (!confirmar) return; // Si el usuario presiona "Cancelar", no hace nada// 🟡 Ventana de confirmación antes de enviar
  try {
    const token = getToken();
    if (!token) { setMsg("Tu sesión no está activa. Inicia sesión nuevamente."); nav("/login", { replace: true }); return; }

    // 1) Guardar borrador (aseguramos que lo último quede en DB)
    const payload = {
      email: f.email,
      nombres: f.nombres,
      apellidos: f.apellidos,
      tipoDocumento: "CI",
      nroDocumento: f.ci,
      pais: "Bolivia",
      departamento: f.departamento,
      ciudad: f.ciudad,
      direccion: f.domicilio,
      institucion: f.entidadRepresenta,
      cargo: f.cargoRelacion,
      telefono: f.telefono,
      fechaNacimiento: f.fechaNacimiento,
      documentos: docs,
      docsPorCampo: docsPorCampo,
    };

    const d = await authJson("/api/register/user/draft", {
      method: "POST",
      body: JSON.stringify({ data: payload }),
    });
    if (!d.ok) throw new Error(d.data?.error || `Error guardando datos (${d.status})`);

    // 2) Enviar (esto crea/actualiza UserProfile a ENVIADO → el revisor lo ve)
    const s = await authJson("/api/register/user/submit", { method: "POST" });
    if (!s.ok) throw new Error(s.data?.error || `Error al enviar (${s.status})`);

    setMsg("✅ Enviado para revisión. Un revisor debe aprobarte.");
    setTimeout(() => {
      nav("/login", { replace: true });
    }, 2000);
  } catch (err: any) {
    setMsg("❌ " + (err?.message || "Error al registrar"));
  }
};


 
const onLogout = () => {
  const ok = window.confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (!ok) return;
  try {
    // Si prefieres, solo borra el token:
    // localStorage.removeItem("token");
    localStorage.clear();
  } finally {
    nav("/login", { replace: true });
  }
};

// Guardar borrador actual del formulario
const guardarBorrador = async () => {
  try {
    const token = getToken();
    if (!token) { setMsg("Tu sesión no está activa. Inicia sesión."); nav("/login", { replace: true }); return; }

    const payload = {
      nombres: f.nombres,
      apellidos: f.apellidos,
      email: f.email,
      telefono: f.telefono,
      tipoDocumento: "CI",
      nroDocumento: f.ci,
      pais: "Bolivia",
      departamento: f.departamento,
      ciudad: f.ciudad,
      direccion: f.domicilio,
      institucion: f.entidadRepresenta,
      cargo: f.cargoRelacion,
      fechaNacimiento: f.fechaNacimiento,
      documentos: docs,
      docsPorCampo: docsPorCampo,
    };

    const r = await authJson("/api/register/user/draft", {
      method: "POST",
      body: JSON.stringify({ data: payload }), // 👈 IMPORTANTE: el backend espera { data: {...} }
    });

    if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
    setMsg("💾 Borrador guardado.");
  } catch (err: any) {
    setMsg("❌ " + (err?.message || "Error al guardar borrador"));
  }
};




  return (
    <div className="form-shell">
      <div className="form-card">
        <SectionTitle
          title="Datos personales"
          note="Cuando envíe este formulario, no recopilaremos automáticamente sus datos personales a menos que usted los proporcione. Los campos con * son obligatorios."
        />

        <form onSubmit={submit} className="form-grid">
  <Field
    label="1. Nombre(s)*"
    desc="Como se muestra en su documento de identificación"
    required
  >
    <input
      className="input"
      value={f.nombres || ""}
      onChange={(e) => setField("nombres", e.target.value)}
    />
  </Field>

  <Field
    label="2. Apellido(s)*"
    desc="Como se muestra en su documento de identificación"
    required
  >
    <input
      className="input"
      value={f.apellidos || ""}
      onChange={(e) => setField("apellidos", e.target.value)}
    />
  </Field>

  <Field
    label="3. Dirección de correo electrónico *"
    desc="Correo personal o institucional donde desea recibir notificaciones"
    required
  >
    <input
      className="input"
      type="email"
      value={f.email || ""}
      onChange={(e) => setField("email", e.target.value)}
    />
  </Field>

  <Field
    label="4. Teléfono *"
    desc="Incluya código de país si corresponde"
    required
  >
    <input
      className="input"
      type="tel"
      value={f.telefono || ""}
      onChange={(e) => setField("telefono", e.target.value)}
    />
  </Field>

  <Field
    label="5. Cédula de identidad *"
    desc="Número completo del documento de identidad"
    required
  >
    <input
      className="input"
      value={f.ci || ""}
      onChange={(e) => setField("ci", e.target.value)}
    />
    <UploadPerField onUpload={(files) => handleUploadPerField("doc_ci", files)} />
  </Field>

  <Field
    label="6. Documento de antecedentes penales"
    desc="Certificado vigente emitido por autoridad competente (REJAP)"
  >
    <UploadPerField onUpload={(files) => handleUploadPerField("doc_antecedentes", files)} />
  </Field>

  <Field
    label="7. Cargo que ocupa / Relación laboral"
    desc="Cargo/función y tipo de vínculo laboral o contractual"
  >
    <input
      className="input"
      value={f.cargoRelacion || ""}
      onChange={(e) => setField("cargoRelacion", e.target.value)}
    />
    <UploadPerField onUpload={(files) => handleUploadPerField("doc_cargo", files)} />
  </Field>

  <Field
    label="8. Entidad a la que representa *"
    desc="Nombre completo de la institución a la cual pertenece"
    required
  >
    <input
      className="input"
      value={f.entidadRepresenta || ""}
      onChange={(e) => setField("entidadRepresenta", e.target.value)}
    />
  </Field>

  <Field
    label="9. Domicilio"
    desc="Calle, número, zona, ciudad"
    full
  >
    <input
      className="input"
      value={f.domicilio || ""}
      onChange={(e) => setField("domicilio", e.target.value)}
    />
  </Field>

  <Field label="10. Departamento">
    <input
      className="input"
      value={f.departamento || ""}
      onChange={(e) => setField("departamento", e.target.value)}
    />
  </Field>

  <Field label="11. Ciudad/Municipio">
    <input
      className="input"
      value={f.ciudad || ""}
      onChange={(e) => setField("ciudad", e.target.value)}
    />
  </Field>

  <Field
    label="12. Documento de acreditación de representación"
    desc="Nota de designación o carta institucional firmada por autoridad"
    full
  >
    <UploadPerField onUpload={(files) => handleUploadPerField("doc_acreditacion", files)} />
  </Field>

  <Field label="13. Fecha de nacimiento">
    <input
      className="input"
      type="date"
      value={f.fechaNacimiento || ""}
      onChange={(e) => setField("fechaNacimiento", e.target.value)}
    />
  </Field>


          <div className="hr" />

          <Field label="Adjuntos generales" desc="Use esta zona para otros respaldos globales al registro" full>
            <input
  type="file"
  multiple
  onChange={async (e) => {
    if (!e.currentTarget.files) return;
    try {
      setMsg("Subiendo adjuntos...");
      const ups = await uploadFiles(e.currentTarget.files, "general"); // 👈 SIN docType
      setDocs((prev) => [...prev, ...ups]);
      setMsg("✅ Adjuntos subidos");
    } catch (err: any) {
      setMsg("❌ " + (err?.message || "Error subiendo adjuntos"));
    } finally {
      e.currentTarget.value = "";
    }
  }}
/>
          </Field>

          <div className="actions">
            <button type="submit" className="btn btn-primary">Enviar formulario</button>
            <button type="button" onClick={onLogout} className="bg-red-600 hover:bg-red-500 rounded-xl px-4 py-2"
  >
    Cerrar sesión
  </button>
          </div>

          {msg && <div className="field-full help">{msg}</div>}
        </form>
      </div>
    </div>
  );

  
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,6);
}
