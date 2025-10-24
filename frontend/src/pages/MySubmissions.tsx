
import React, { useEffect, useState } from 'react';
import { useUserAuth } from '../AuthUser';
import { Link } from 'react-router-dom';

type Report = { id:string; tipo:'APROBACION'|'OBSERVACIONES'; folio:string; createdAt:string; pdfPath:string };
type Registro = { id:string; estado:string; enviadaAt:string; reportes: Report[] };
type EntidadItem = { id:string; nombre:string; approved:string; draftState:string|null; approvalMeta?:any; registro: Registro|null };
type ProyectoItem = { id:string; nombre:string; entidadId:string; approved:string; draftState:string|null; approvalMeta?:any; registro: Registro|null };

export default function MySubmissions(){
  const { token, logout } = useUserAuth();
  const [data, setData] = useState<{ entidad:EntidadItem|null; proyectos:ProyectoItem[]; userApproved:string }|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  useEffect(()=>{
    (async ()=>{
      try{
        const r = await fetch('/api/user/submissions',{ headers: { Authorization: `Bearer ${token}` }});
        const d = await r.json();
        if(!r.ok) throw new Error(d?.error || 'Error al cargar');
        setData(d);
      }catch(e:any){ setErr(e.message); }
      finally{ setLoading(false); }
    })();
  }, [token]);

  if(loading) return <div style={{padding:24}}>Cargando…</div>;
  if(err) return <div style={{padding:24, color:'#ef4444'}}>Error: {err}</div>;

  const Badge = ({text}:{text:string}) => <span style={{fontSize:12, padding:'2px 8px', border:'1px solid #374151', borderRadius:999}}>{text}</span>;

  const renderRegistro = (r: Registro|null) => {
    if(!r) return <div style={{fontSize:13, color:'#9CA3AF'}}>Sin envíos aún.</div>;
    return (
      <div style={{marginTop:8}}>
        <div style={{fontSize:13}}>Estado: <b>{r.estado}</b> · Enviado: {new Date(r.enviadaAt).toLocaleString()}</div>
        <div style={{marginTop:6}}>
          <div style={{fontSize:13, fontWeight:600}}>Reportes</div>
          {r.reportes?.length ? (
            <ul style={{fontSize:13, marginTop:4}}>
              {r.reportes.map(rep => (
                <li key={rep.id} style={{display:'flex', justifyContent:'space-between'}}>
                  <span>{rep.folio} · {rep.tipo} · {new Date(rep.createdAt).toLocaleString()}</span>
                  {rep.pdfPath ? (
                    <a style={{color:'#60a5fa'}} href={'/files/secure?path='+encodeURIComponent(rep.pdfPath)} target='_blank'>Ver PDF</a>
                  ) : <span style={{color:'#9CA3AF'}}>PDF no disponible</span>}
                </li>
              ))}
            </ul>
          ) : <div style={{fontSize:12, color:'#9CA3AF'}}>Sin reportes todavía.</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={{minHeight:'100vh', background:'#0B1220', color:'#E5E7EB', padding:24}}>
      <div style={{maxWidth:960, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h1 style={{fontSize:22, fontWeight:700}}>Mis envíos</h1>
          <div style={{display:'flex', gap:8}}>
            <Link to="/panel" style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10}}>Volver al panel</Link>
            <button onClick={logout} style={{border:'1px solid #374151', padding:'8px 12px', borderRadius:10}}>Salir</button>
          </div>
        </div>

        <div style={{background:'#111827', borderRadius:16, padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{fontSize:16, fontWeight:600}}>Entidad</h2>
            <div style={{display:'flex', gap:8}}>
              {data?.entidad?.approved && <Badge text={'Aprobación: '+(data.entidad.approved||'—')}/>}
              {data?.entidad?.draftState && <Badge text={'Borrador: '+(data.entidad.draftState||'—')}/>}
            </div>
          </div>
          <div style={{fontSize:13, marginTop:4}}>{data?.entidad ? <b>{data.entidad.nombre}</b> : 'No has creado una entidad'}</div>
          {renderRegistro(data?.entidad?.registro || null)}
        </div>

        <div style={{marginTop:16, background:'#111827', borderRadius:16, padding:16}}>
          <h2 style={{fontSize:16, fontWeight:600}}>Proyectos</h2>
          {data?.proyectos?.length ? (
            <div style={{marginTop:8}}>
              {data.proyectos.map(p => (
                <div key={p.id} style={{borderTop:'1px solid #1f2937', paddingTop:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{fontSize:13, fontWeight:600}}>{p.nombre} <span style={{fontSize:12, color:'#9CA3AF'}}>(ID {p.id})</span></div>
                    <div style={{display:'flex', gap:8}}>
                      {p.approved && <Badge text={'Aprobación: '+(p.approved||'—')}/>}
                      {p.draftState && <Badge text={'Borrador: '+(p.draftState||'—')}/>}
                    </div>
                  </div>
                  {renderRegistro(p.registro || null)}
                </div>
              ))}
            </div>
          ) : <div style={{fontSize:13, color:'#9CA3AF'}}>Aún no registraste proyectos.</div>}
        </div>
      </div>
    </div>
  );
}
