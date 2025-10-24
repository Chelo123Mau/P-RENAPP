
import React, { useEffect, useState } from 'react';
import { useUserAuth } from '../AuthUser';
import { Link } from 'react-router-dom';
import FieldUpload from '../components/FieldUpload';

type Archivo = { id: string; originalName: string; storagePath: string; size: number; mimeType: string; hash: string; createdAt: string };

const ENTIDAD_FIELDS = [
  { key:'sigla', label:'Sigla', requiresDocs:false },
  { key:'tipo', label:'Tipo', requiresDocs:false },
  { key:'emailContacto', label:'Correo de contacto', requiresDocs:false },
  { key:'pais', label:'País', requiresDocs:false },
  { key:'departamento', label:'Departamento', requiresDocs:false },
  { key:'municipio', label:'Municipio', requiresDocs:false },
  { key:'direccion', label:'Dirección', requiresDocs:false },
  { key:'telefono', label:'Teléfono', requiresDocs:false },
  { key:'fechaConstitucion', label:'Fecha constitución', requiresDocs:true }
];

const PROY_FIELDS = [
  { key:'sector', label:'Sector', requiresDocs:false },
  { key:'subSector', label:'Sub-sector', requiresDocs:false },
  { key:'financiador', label:'Financiador', requiresDocs:true },
  { key:'departamento', label:'Departamento', requiresDocs:false },
  { key:'municipio', label:'Municipio', requiresDocs:false },
  { key:'costoEstimado', label:'Costo estimado (USD)', requiresDocs:false },
  { key:'periodoInicio', label:'Periodo inicio', requiresDocs:false },
  { key:'periodoFin', label:'Periodo fin', requiresDocs:false },
  { key:'mecanismoMercado', label:'Mecanismo de mercado', requiresDocs:true },
  { key:'reduccionEstim', label:'Reducción estimada (tCO2e)', requiresDocs:true },
  { key:'mrv', label:'MRV (documento/protocolo)', requiresDocs:true }
];

export default function UserPanel(){
  const { user, token, refresh, logout } = useUserAuth();

  const [entidadForm, setEntidadForm] = useState({ nombre:'', nit:'', representante:'' });
  const [entidadExtras, setEntidadExtras] = useState<any>({});
  const [entidadDocs, setEntidadDocs] = useState<Archivo[]>([]);
  const [entidadDocsPorCampo, setEntidadDocsPorCampo] = useState<Record<string, Archivo[]>>({});
  const [entidadMsg, setEntidadMsg] = useState<string>('');
  const [entidadLoading, setEntidadLoading] = useState(false);
  const [entidadErrs, setEntidadErrs] = useState<any>({});

  const [proyectoForm, setProyectoForm] = useState({ id:'', nombre:'' });
  const [proyectoExtras, setProyectoExtras] = useState<any>({});
  const [proyectoDocs, setProyectoDocs] = useState<Archivo[]>([]);
  const [proyectoDocsPorCampo, setProyectoDocsPorCampo] = useState<Record<string, Archivo[]>>({});
  const [proyectoMsg, setProyectoMsg] = useState<string>('');
  const [proyectoLoading, setProyectoLoading] = useState(false);
  const [proyectoErrs, setProyectoErrs] = useState<any>({});

  useEffect(()=>{
    setEntidadMsg(''); setProyectoMsg('');
    setEntidadErrs({}); setProyectoErrs({});
  }, [user?.id]);

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const valEntidad = () => {
    const e:any = {};
    if (!entidadForm.nombre?.trim()) e.nombre = 'Nombre de la entidad es requerido';
    if (!entidadForm.nit?.trim()) e.nit = 'NIT es requerido';
    if (!entidadForm.representante?.trim()) e.representante = 'Representante es requerido';
    setEntidadErrs(e); return !Object.keys(e).length;
  };
  const valProyecto = () => {
    const e:any = {};
    if (!proyectoForm.nombre?.trim()) e.nombre = 'Nombre del proyecto es requerido';
    setProyectoErrs(e); return !Object.keys(e).length;
  };

  const uploadFiles = async (files: FileList, setList: (a:Archivo[])=>void) => {
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    const r = await fetch('/api/upload', { method:'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'No se pudo subir');
    setList(prev => [...d.files, ...prev]);
  };
  const removeDoc = (id: string, setList: (a:Archivo[])=>void) => setList(prev => prev.filter(x => x.id !== id));
  const setEntExtra = (k:string,v:any)=> setEntidadExtras((e:any)=>({...e,[k]:v}));
  const setProyExtra = (k:string,v:any)=> setProyectoExtras((e:any)=>({...e,[k]:v}));
  const setEntDocsCampo = (k:string, list:Archivo[]) => setEntidadDocsPorCampo(prev=>({...prev,[k]:list}));
  const setProyDocsCampo = (k:string, list:Archivo[]) => setProyectoDocsPorCampo(prev=>({...prev,[k]:list}));

  const guardarEntidadBorrador = async () => {
    setEntidadMsg(''); if (!valEntidad()) return;
    setEntidadLoading(true);
    try {
      const r = await fetch('/api/register/entidad/draft', {
        method: 'POST', headers, body: JSON.stringify({ ...entidadForm, documentos: entidadDocs, extras: entidadExtras, docsPorCampo: entidadDocsPorCampo })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al guardar borrador');
      setEntidadMsg('✅ Borrador de entidad guardado');
      await refresh();
    } catch (e:any) { setEntidadMsg('❌ ' + e.message); }
    finally { setEntidadLoading(false); }
  };

  const enviarEntidad = async () => {
    setEntidadMsg(''); if (!valEntidad()) return;
    setEntidadLoading(true);
    try {
      await fetch('/api/register/entidad/draft', {
        method: 'POST', headers, body: JSON.stringify({ ...entidadForm, documentos: entidadDocs, extras: entidadExtras, docsPorCampo: entidadDocsPorCampo })
      });
      const r = await fetch('/api/register/entidad/submit', { method: 'POST', headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al enviar entidad');
      setEntidadMsg('📤 Entidad enviada para revisión');
      await refresh();
    } catch (e:any) { setEntidadMsg('❌ ' + e.message); }
    finally { setEntidadLoading(false); }
  };

  const guardarProyectoBorrador = async () => {
    setProyectoMsg(''); if (!valProyecto()) return;
    setProyectoLoading(true);
    try {
      const r = await fetch('/api/register/proyecto/draft', {
        method: 'POST', headers, body: JSON.stringify({ id: proyectoForm.id || undefined, nombre: proyectoForm.nombre, documentos: proyectoDocs, extras: proyectoExtras, docsPorCampo: proyectoDocsPorCampo })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al guardar borrador');
      setProyectoForm(p => ({ ...p, id: d.id }));
      setProyectoMsg('✅ Borrador de proyecto guardado (id: ' + d.id + ')');
    } catch (e:any) {
      setProyectoMsg('❌ ' + e.message + (e.message.includes('Entidad') ? ' — La entidad debe estar APROBADA por un revisor.' : ''));
    } finally { setProyectoLoading(false); }
  };

  const enviarProyecto = async () => {
    if (!proyectoForm.id) { setProyectoMsg('❌ Antes guarda un borrador de proyecto'); return; }
    setProyectoMsg(''); if (!valProyecto()) return;
    setProyectoLoading(true);
    try {
      const r = await fetch('/api/register/proyecto/submit', {
        method: 'POST', headers, body: JSON.stringify({ id: proyectoForm.id, documentos: proyectoDocs, extras: proyectoExtras, docsPorCampo: proyectoDocsPorCampo })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al enviar proyecto');
      setProyectoMsg('📤 Proyecto enviado para revisión');
    } catch (e:any) { setProyectoMsg('❌ ' + e.message); }
    finally { setProyectoLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh', background:'#0B1220', color:'#E5E7EB', padding:'24px'}}>
      <div style={{maxWidth:1100, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h1 style={{fontSize:22, fontWeight:700}}>Panel de Usuario</h1>
          <div style={{display:'flex', gap:8}}>
            <Link to="/mis-envios" style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10, color:'#fff'}}>Mis envíos</Link>
            <button onClick={logout} style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10}}>Salir</button>
          </div>
        </div>

        <div style={{background:'#111827', borderRadius:16, padding:20}}>
          <h2 style={{fontSize:16, fontWeight:600, marginBottom:8}}>Registro de Entidad</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
            <div>
              <input placeholder="Nombre de la entidad" value={entidadForm.nombre}
                     onChange={e=>setEntidadForm({...entidadForm, nombre:e.target.value})}
                     style={{padding:10, borderRadius:10, width:'100%'}} />
              {entidadErrs.nombre && <div style={{fontSize:12, color:'#fca5a5'}}>{entidadErrs.nombre}</div>}
            </div>
            <div>
              <input placeholder="NIT" value={entidadForm.nit}
                     onChange={e=>setEntidadForm({...entidadForm, nit:e.target.value})}
                     style={{padding:10, borderRadius:10, width:'100%'}} />
              {entidadErrs.nit && <div style={{fontSize:12, color:'#fca5a5'}}>{entidadErrs.nit}</div>}
            </div>
            <div>
              <input placeholder="Representante" value={entidadForm.representante}
                     onChange={e=>setEntidadForm({...entidadForm, representante:e.target.value})}
                     style={{padding:10, borderRadius:10, width:'100%'}} />
              {entidadErrs.representante && <div style={{fontSize:12, color:'#fca5a5'}}>{entidadErrs.representante}</div>}
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:8}}>
            {ENTIDAD_FIELDS.map(f => (
              <div key={f.key}>
                <input placeholder={f.label} value={entidadExtras[f.key]||''}
                       onChange={e=>setEntExtra(f.key, e.target.value)}
                       style={{padding:10, borderRadius:10, width:'100%'}} />
                {f.requiresDocs && (
                  <div style={{marginTop:6}}>
                    <FieldUpload token={token} fieldKey={f.key} files={entidadDocsPorCampo[f.key]||[]} onChange={l=>setEntDocsCampo(f.key, l)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{marginTop:10}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Documentos de entidad (generales)</div>
            <input type="file" multiple onChange={e=> e.target.files && uploadFiles(e.target.files, setEntidadDocs)} />
            {entidadDocs.length>0 && (
              <ul style={{marginTop:8, fontSize:13}}>
                {entidadDocs.map(d=>(
                  <li key={d.id} style={{display:'flex', justifyContent:'space-between'}}>
                    <span>{d.originalName} · {Math.round(d.size/1024)} KB</span>
                    <button style={{textDecoration:'underline'}} onClick={()=>removeDoc(d.id, setEntidadDocs)}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{marginTop:10, display:'flex', gap:8}}>
            <button disabled={entidadLoading} onClick={guardarEntidadBorrador} style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10}}>Guardar borrador</button>
            <button disabled={entidadLoading} onClick={enviarEntidad} style={{background:'#2563eb', color:'#fff', padding:'8px 12px', borderRadius:10}}>Enviar formulario</button>
          </div>
          {entidadMsg && <div style={{marginTop:6, fontSize:13}}>{entidadMsg}</div>}
        </div>

        <div style={{marginTop:16, background:'#111827', borderRadius:16, padding:20}}>
          <h2 style={{fontSize:16, fontWeight:600, marginBottom:8}}>Registro de Proyecto</h2>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:8}}>
            <div>
              <input placeholder="Nombre del proyecto" value={proyectoForm.nombre}
                     onChange={e=>setProyectoForm({...proyectoForm, nombre:e.target.value})}
                     style={{padding:10, borderRadius:10, width:'100%'}} />
              {proyectoErrs.nombre && <div style={{fontSize:12, color:'#fca5a5'}}>{proyectoErrs.nombre}</div>}
            </div>
            <div>
              <input placeholder="ID (si ya guardaste borrador)" value={proyectoForm.id}
                     onChange={e=>setProyectoForm({...proyectoForm, id:e.target.value})}
                     style={{padding:10, borderRadius:10, width:'100%'}} />
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:8}}>
            {PROY_FIELDS.map(f => (
              <div key={f.key}>
                <input placeholder={f.label} value={proyectoExtras[f.key]||''}
                       onChange={e=>setProyExtra(f.key, e.target.value)}
                       style={{padding:10, borderRadius:10, width:'100%'}} />
                {f.requiresDocs && (
                  <div style={{marginTop:6}}>
                    <FieldUpload token={token} fieldKey={f.key} files={proyectoDocsPorCampo[f.key]||[]} onChange={l=>setProyDocsCampo(f.key, l)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{marginTop:10}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Documentos de proyecto (generales)</div>
            <input type="file" multiple onChange={e=> e.target.files && uploadFiles(e.target.files, setProyectoDocs)} />
            {proyectoDocs.length>0 && (
              <ul style={{marginTop:8, fontSize:13}}>
                {proyectoDocs.map(d=>(
                  <li key={d.id} style={{display:'flex', justifyContent:'space-between'}}>
                    <span>{d.originalName} · {Math.round(d.size/1024)} KB</span>
                    <button style={{textDecoration:'underline'}} onClick={()=>removeDoc(d.id, setProyectoDocs)}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{marginTop:10, display:'flex', gap:8}}>
            <button disabled={proyectoLoading} onClick={guardarProyectoBorrador} style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10}}>Guardar borrador</button>
            <button disabled={proyectoLoading} onClick={enviarProyecto} style={{background:'#2563eb', color:'#fff', padding:'8px 12px', borderRadius:10}}>Enviar formulario</button>
          </div>
          {proyectoMsg && <div style={{marginTop:6, fontSize:13}}>{proyectoMsg}</div>}
        </div>
      </div>
    </div>
  );
}
