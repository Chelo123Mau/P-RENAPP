import React, { useState } from 'react';
import { SectionTitle, Field, UploadPerField } from '../components/FormPieces';

type Archivo = { id:string; originalName:string; storagePath:string; size:number; mimeType:string; hash:string; createdAt:string; };
async function uploadFiles(files: FileList){ const fd=new FormData(); Array.from(files).forEach(f=>fd.append('files', f));
  const r=await fetch('/api/upload',{method:'POST',body:fd}); const d=await r.json(); if(!r.ok) throw new Error(d?.error||'No se pudo subir'); return d.files as Archivo[]; }

export default function RegisterEntity(){
  const [f, setF] = useState({
    nombreInstitucion:'', correo:'', telefono:'', direccion:'', web:'',
    tipoEntidad:'', fechaConstitucion:'', lugarConstitucion:'', representanteLegal:'',
    numeroComercial:'', nit:'', nacionalExtranjera:'Nacional'
  });
  const [docs, setDocs] = useState<Archivo[]>([]);
  const [docsPorCampo, setDocsPorCampo] = useState<Record<string, Archivo[]>>({});
  const setField = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setF((p)=>({ ...p, [k]: e.target.value }));
  const up = async (key:string, files: FileList) => {
    const ups = await uploadFiles(files);
    setDocsPorCampo(prev=>({ ...prev, [key]: [ ...(prev[key]||[]), ...ups ] }));
  };

  const submit = async (e:React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: undefined,
      nombre: f.nombreInstitucion,
      documentos: docs,
      extras: {
        correo: f.correo, telefono: f.telefono, direccion: f.direccion, web: f.web,
        tipoEntidad: f.tipoEntidad, fechaConstitucion: f.fechaConstitucion, lugarConstitucion: f.lugarConstitucion,
        representanteLegal: f.representanteLegal, numeroComercial: f.numeroComercial, nit: f.nit,
        nacionalExtranjera: f.nacionalExtranjera
      },
      docsPorCampo
    };
    const r = await fetch('/api/register/entidad/draft', { method:'POST', headers:{'Content-Type':'application/json','Authorization':localStorage.getItem('token')||''}, body: JSON.stringify(payload) });
    const d = await r.json();
    if(!r.ok) return alert(d?.error || 'Error guardando borrador');
    const r2 = await fetch('/api/register/entidad/submit', { method:'POST', headers:{'Content-Type':'application/json','Authorization':localStorage.getItem('token')||''}, body: JSON.stringify({}) });
    const d2 = await r2.json();
    if(!r2.ok) return alert(d2?.error || 'Error enviando entidad');
    alert('Entidad enviada a revisión');
  };

  return (
    <div className="form-shell">
      <div className="form-card">
        <SectionTitle title="Datos de la entidad" note="Complete la información de su institución. Los campos con * son obligatorios." />
        <form onSubmit={submit} className="form-grid">

          <Field label="Nombre de la institución *" desc="Nombre legal completo" required full>
            <input className="input" value={f.nombreInstitucion} onChange={setField('nombreInstitucion')} />
            <UploadPerField onUpload={(files)=>up('doc_denom_legal', files)} />
          </Field>

          <Field label="Datos de contacto: Dirección" desc="Dirección física" full>
            <input className="input" value={f.direccion} onChange={setField('direccion')} />
          </Field>

          <Field label="Correo institucional">
            <input className="input" type="email" value={f.correo} onChange={setField('correo')} />
          </Field>

          <Field label="Teléfono">
            <input className="input" value={f.telefono} onChange={setField('telefono')} />
          </Field>

          <Field label="Página web">
            <input className="input" value={f.web} onChange={setField('web')} />
          </Field>

          <Field label="Tipo de entidad" desc="Ministerio, pública, ONG, privada u otra">
            <input className="input" value={f.tipoEntidad} onChange={setField('tipoEntidad')} />
          </Field>

          <Field label="Fecha de constitución">
            <input className="input" type="date" value={f.fechaConstitucion} onChange={setField('fechaConstitucion')} />
          </Field>

          <Field label="Lugar de constitución">
            <input className="input" value={f.lugarConstitucion} onChange={setField('lugarConstitucion')} />
            <UploadPerField onUpload={(files)=>up('doc_constitucion', files)} />
          </Field>

          <Field label="Representante legal">
            <input className="input" value={f.representanteLegal} onChange={setField('representanteLegal')} />
            <UploadPerField onUpload={(files)=>up('doc_poder', files)} />
          </Field>

          <Field label="Número comercial / Matrícula">
            <input className="input" value={f.numeroComercial} onChange={setField('numeroComercial')} />
            <UploadPerField onUpload={(files)=>up('doc_matricula', files)} />
          </Field>

          <Field label="NIT">
            <input className="input" value={f.nit} onChange={setField('nit')} />
            <UploadPerField onUpload={(files)=>up('doc_nit', files)} />
          </Field>

          <Field label="Nacional o extranjera">
            <select className="select" value={f.nacionalExtranjera} onChange={setField('nacionalExtranjera')}>
              <option value="Nacional">Nacional</option>
              <option value="Extranjera">Extranjera</option>
            </select>
          </Field>

          <Field label="Documento que acredite constitución en el país (si corresponde)" full>
            <UploadPerField onUpload={(files)=>up('doc_constitucion_en_pais', files)} />
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
