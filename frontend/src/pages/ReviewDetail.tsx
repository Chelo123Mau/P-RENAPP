import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const HISTORY_ENABLED = false; // ⛔ historial temporalmente deshabilitado


type Archivo = { id:string; originalName:string; storagePath:string; size:number; mimeType:string; createdAt:string; };
type Registro = {
  id: string;
  tipo: 'USUARIO'|'ENTIDAD'|'PROYECTO';
  estado: 'PENDIENTE'|'APROBADO'|'OBSERVADO';
  solicitante: { id:string; nombre:string; email:string };
  entidad?: { id:string; nombre:string } | null;
  enviadosAt: string;
  data: Record<string, any>;          // todos los campos llenados por el solicitante
  documentos: Archivo[];              // adjuntos generales
  docsPorCampo?: Record<string, Archivo[]>; // adjuntos por campo
};

export default function ReviewDetail(){
  const nav = useNavigate();
  const { tipo = '', id = '' } = useParams(); // tipo en url: usuario|entidad|proyecto
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [reg, setReg] = useState<Registro | null>(null);

  // Estado del “canvas” y opciones de informe
  const [comentario, setComentario] = useState('');
  const [tipoReporte, setTipoReporte] = useState<'aprobacion'|'observaciones'>('aprobacion');
  const [enviarEmail, setEnviarEmail] = useState(true);

  const token = localStorage.getItem('token') || '';

  useEffect(() => {
  (async () => {
    try {
      const auth = { 'Authorization': `Bearer ${token}` };

      // 1) Primero intenta /api/review/registro/:tipo/:id
      let r = await fetch(`/api/review/registro/${tipo}/${id}`, { headers: auth });
      let text = await r.text();
      let d: any = {};
      try { d = JSON.parse(text); } catch {}

      // 2) Si no esa ruta en tu backend, intenta /api/review/registro/:id
      if (!r.ok && r.status === 404) {
        r = await fetch(`/api/review/registro/${id}`, { headers: auth });
        text = await r.text();
        d = {};
        try { d = JSON.parse(text); } catch {}
      }

      if (!r.ok) throw new Error(d?.error || `Falló obtener registro (status ${r.status})`);

      // 3) Normalizar shape desde backend
      const raw = d.registro || d;               // tu backend puede devolver {registro: ...} o directo el objeto
      const f = raw.formulario || {};
      const campos = Array.isArray(f.campos) ? f.campos : [];

      // Convierte [{key,label,value}] -> data: { key: value }
      const dataObj: Record<string, any> = {};
      for (const c of campos) {
        const k = (c?.key ?? '').toString();
        if (k) dataObj[k] = c?.value ?? '';
      }

      const documentos = Array.isArray(f.documentos) ? f.documentos : (raw.documentos || []);
      const docsPorCampo = f.docsPorCampo || raw.docsPorCampo || {};

      // 4) Arma el objeto Registro que la UI espera
      const registroNormalizado: Registro = {
        id: raw.id,
        tipo: (raw.tipo || (tipo || '').toUpperCase()),
        estado: raw.estado || 'PENDIENTE',
        solicitante: {
          id: raw.solicitanteId || '',
          nombre: raw.solicitanteNombre || '',
          email: raw.solicitanteEmail || '',
        },
        entidad: raw.entidadNombre ? { id: raw.entidadId || '', nombre: raw.entidadNombre } : null,
        enviadosAt: raw.enviadaAt || raw.createdAt || '',
        data: dataObj,
        documentos,
        docsPorCampo
      };

      setReg(registroNormalizado);
    } catch (err: any) {
      setMsg('❌ ' + (err?.message || 'Error cargando el registro'));
    } finally {
      setLoading(false);
    }
  })();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [tipo, id]);


  const niceTipo = useMemo(() => (tipo||'').toUpperCase(), [tipo]);

  const descargar = async (a: Archivo) => {
  try {
    const token = localStorage.getItem('token') || '';
    if (!a.storagePath) throw new Error('Archivo sin ruta de almacenamiento');

    // construye la URL usando "path"
    const url = `/files/secure?path=${encodeURIComponent(a.storagePath)}`;

    // usa fetch con token para obtener el archivo como blob
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Fallo al descargar (${r.status}): ${txt || 'sin detalle'}`);
    }

    const blob = await r.blob();
    const filename = a.originalName || a.name || 'archivo';

    // forzar descarga en navegador
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err: any) {
    setMsg('❌ ' + (err?.message || 'Error al descargar el archivo'));
  }
};


  const aprobar = async () => {
    setMsg('');
    try{
      const r = await fetch(`/api/review/${tipo}/${id}/approve`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ comentario })
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d?.error || 'No se pudo aprobar');
      setMsg('✅ Registro aprobado');
    }catch(err:any){ setMsg('❌ '+err.message); }
  };

  const observar = async () => {
    setMsg('');
    try{
      const r = await fetch(`/api/review/${tipo}/${id}/observe`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ comentario })
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d?.error || 'No se pudo marcar como observado');
      setMsg('✅ Registro marcado como observado');
    }catch(err:any){ setMsg('❌ '+err.message); }
  };
  
  const generarReporte = async () => {
  setMsg('');
  try {
    const r = await fetch(`/api/review/${tipo}/${id}/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // 👇 importante: no forzar JSON si esperas un PDF
        // 'Accept': 'application/pdf',
      },
      body: JSON.stringify({ tipo: tipoReporte, comentario, enviarEmail }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(text || `Error ${r.status} al generar el reporte`);
    }

    // ⚙️ Verifica si el backend realmente devolvió un PDF
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/pdf')) {
      const html = await r.text().catch(() => '');
      throw new Error(
        `El servidor no devolvió un PDF. Tipo: ${ct}. Respuesta:\n${html.slice(0, 200)}`
      );
    }

    // ✅ Es un PDF → lo descargamos
    const blob = await r.blob();
    const filename = `reporte_${tipoReporte}_${id}.pdf`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    setMsg(`✅ Reporte generado${enviarEmail ? ' y enviado por correo' : ''}.`);
  } catch (err: any) {
    setMsg('❌ ' + (err?.message || 'No se pudo generar el reporte'));
  }
};


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6 flex items-center justify-center">
        <div>Cargando registro…</div>
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6 flex items-center justify-center">
        <div className="bg-[#111827] rounded-2xl p-6 max-w-lg w-full">
          <h1 className="text-xl font-semibold mb-2">Detalle de registro</h1>
          <div className="text-sm">{msg || 'No se encontró el registro.'}</div>
          <div className="mt-4">
            <button onClick={()=>nav('/review')} className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(reg.data || {});

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Revisión · {niceTipo}</h1>
            <p className="opacity-80 text-sm">
              Solicitante: {reg.solicitante?.nombre} · {reg.solicitante?.email} · Estado: {reg.estado}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>nav('/review')} className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700">Volver</button>
            <button onClick={()=>{ localStorage.clear(); window.location.href='/'; }} className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700">Salir</button>
          </div>
        </div>

        {/* Datos llenados en el formulario */}
        <div className="bg-[#111827] rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-3">Datos del formulario</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {entries.length === 0 && <div className="opacity-70 text-sm">Sin campos.</div>}
            {entries.map(([k, v]) => (
              <div key={k} className="bg-gray-800/50 rounded-xl p-3">
                <div className="text-xs opacity-70">{k}</div>
                <div className="text-sm">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Adjuntos generales */}
        <div className="bg-[#111827] rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-3">Documentos adjuntos</h2>
          {(!reg.documentos || reg.documentos.length === 0) && (
            <div className="opacity-70 text-sm">Sin adjuntos.</div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {reg.documentos?.map(a => (
              <div key={a.id} className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between">
                <div className="text-sm">{a.originalName}</div>
                <button className="px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 text-sm"
                        onClick={()=>descargar(a)}>Descargar</button>
              </div>
            ))}
          </div>
        </div>

        {/* Adjuntos por campo */}
        {reg.docsPorCampo && (
          <div className="bg-[#111827] rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-3">Respaldo por campo</h2>
            {Object.entries(reg.docsPorCampo).map(([campo, arr]) => (
              <div key={campo} className="mb-4">
                <div className="font-medium mb-2">{campo}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  {arr.map(a => (
                    <div key={a.id} className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between">
                      <div className="text-sm">{a.originalName}</div>
                      <button className="px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-700 text-sm"
                              onClick={()=>descargar(a)}>Descargar</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Acciones de revisión */}
        <div className="bg-[#111827] rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Acciones</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de informe</label>
              <select
                className="w-full bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
                value={tipoReporte}
                onChange={e=>setTipoReporte(e.target.value as any)}
              >
                <option value="aprobacion">Reporte de Aprobación</option>
                <option value="observaciones">Reporte de Observaciones</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm mt-2 md:mt-0">
              <input type="checkbox" checked={enviarEmail} onChange={e=>setEnviarEmail(e.target.checked)} />
              Enviar informe por correo al solicitante
            </label>
          </div>

          {/* Canvas / espacio de redacción */}
          <div>
            <label className="block text-sm font-medium mb-1">Conclusiones y observaciones (canvas)</label>
            <textarea
              className="w-full min-h-[140px] bg-gray-800 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-blue-500"
              placeholder="Escriba aquí las conclusiones del revisor o las observaciones..."
              value={comentario}
              onChange={e=>setComentario(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={aprobar} className="rounded-xl px-4 py-2 bg-green-600 hover:bg-green-500">Aprobar registro</button>
            <button onClick={observar} className="rounded-xl px-4 py-2 bg-yellow-600 hover:bg-yellow-500">Marcar como observado</button>
            <button onClick={generarReporte} className="rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-500">Generar informe (PDF)</button>
          </div>

          {msg && <div className="text-sm mt-2">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
