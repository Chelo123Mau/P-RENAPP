import React, { useState } from 'react';
import { SectionTitle, Field, UploadPerField } from '../components/FormPieces';

type Archivo = { id:string; originalName:string; storagePath:string; size:number; mimeType:string; hash:string; createdAt:string; };
async function uploadFiles(files: FileList){ const fd=new FormData(); Array.from(files).forEach(f=>fd.append('files', f));
  const r=await fetch('/api/upload',{method:'POST',body:fd}); const d=await r.json(); if(!r.ok) throw new Error(d?.error||'No se pudo subir'); return d.files as Archivo[]; }

export default function RegisterProject(){
  const [f, setF] = useState({
    titular:'', representanteLegal:'', numeroIdentidad:'', docNotariado:'',
    nombreProyecto:'', modeloMercado:'', area:''
  });
  const [docs, setDocs] = useState<Archivo[]>([]);
  const [docsPorCampo, setDocsPorCampo] = useState<Record<string, Archivo[]>>({});
  const setField = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p)=>({ ...p, [k]: e.target.value }));
  const up = async (key:string, files: FileList) => {
    const ups = await uploadFiles(files);
    setDocsPorCampo(prev=>({ ...prev, [key]: [ ...(prev[key]||[]), ...ups ] }));
  };

  const submit = async (e:React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: undefined,
      nombre: f.nombreProyecto,
      documentos: docs,
      extras: {
        titular: f.titular, representanteLegal: f.representanteLegal,
        numeroIdentidad: f.numeroIdentidad, docNotariado: f.docNotariado,
        modeloMercado: f.modeloMercado, area: f.area
      },
      docsPorCampo
    };
    const r = await fetch('/api/register/proyecto/draft', { method:'POST', headers:{'Content-Type':'application/json','Authorization':localStorage.getItem('token')||''}, body: JSON.stringify(payload) });
    const d = await r.json();
    if(!r.ok) return alert(d?.error || 'Error guardando borrador');
    const r2 = await fetch('/api/register/proyecto/submit', { method:'POST', headers:{'Content-Type':'application/json','Authorization':localStorage.getItem('token')||''}, body: JSON.stringify({ id: d.id }) });
    const d2 = await r2.json();
    if(!r2.ok) return alert(d2?.error || 'Error enviando proyecto');
    alert('Proyecto enviado a revisión');
  };

  return (
    <div className="form-shell">
      <div className="form-card">
        <SectionTitle title="Datos del proyecto o medida de mitigación" />
        <form onSubmit={submit} className="form-grid">

          <Field label="Nombre del titular de la medida" desc="Persona o institución titular">
            <input className="input" value={f.titular} onChange={setField('titular')} />
            <UploadPerField onUpload={(files)=>up('doc_titularidad', files)} />
          </Field>

          <Field label="Nombre del representante legal">
            <input className="input" value={f.representanteLegal} onChange={setField('representanteLegal')} />
            <UploadPerField onUpload={(files)=>up('doc_poder', files)} />
          </Field>

          <Field label="Número de identidad">
            <input className="input" value={f.numeroIdentidad} onChange={setField('numeroIdentidad')} />
            <UploadPerField onUpload={(files)=>up('doc_identidad', files)} />
          </Field>

          <Field label="Número de documento notariado de representación legal">
            <input className="input" value={f.docNotariado} onChange={setField('docNotariado')} />
            <UploadPerField onUpload={(files)=>up('doc_notariado', files)} />
          </Field>

          <Field label="Nombre del programa o proyecto *" required full>
            <input className="input" value={f.nombreProyecto} onChange={setField('nombreProyecto')} />
          </Field>

          <Field label="Modelo de mercado" desc="Voluntario, cumplimiento, bilateral Art.6.2/6.4 u otros" full>
            <input className="input" value={f.modeloMercado} onChange={setField('modeloMercado')} />
            <UploadPerField onUpload={(files)=>up('doc_modelo_mercado', files)} />
          </Field>

          <Field label="Copia de licencia ambiental">
            <UploadPerField onUpload={(files)=>up('doc_licencia_ambiental', files)} />
          </Field>

          <Field label="DDMM aprobado por un OVV" desc="Documento de diseño de medida de mitigación validado">
            <UploadPerField onUpload={(files)=>up('doc_ddmm_ovv', files)} />
          </Field>

          <Field label="Copia del reporte de validación">
            <UploadPerField onUpload={(files)=>up('doc_reporte_validacion', files)} />
          </Field>

          <Field label="Actas y documentación de consultas con actores locales" full>
            <UploadPerField multiple onUpload={(files)=>up('doc_actas_consultas', files)} />
          </Field>

          <Field label="Área del proyecto" desc="Departamento/municipio y superficie">
            <input className="input" value={f.area} onChange={setField('area')} />
            <UploadPerField onUpload={(files)=>up('doc_mapa_area', files)} />
          </Field>

          <Field label="PPM PASA">
            <UploadPerField onUpload={(files)=>up('doc_ppm_pasa', files)} />
          </Field>

          <div className="actions">
            <button className="btn btn-primary" type="submit">Enviar formulario</button>
            <button className="btn btn-ghost" type="button" onClick={()=>alert('Borrador guardado (client)')}>Guardar borrador</button>
          </div>
        </form>
      </div>
    </div>
  );
}
