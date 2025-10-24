import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type Me = {
  id: string;
  email: string;
  nombre: string;
  role: 'user' | 'admin' | 'reviewer';
  approved: 'APROBADO' | 'PENDIENTE' | 'RECHAZADO'; // estado del usuario (si lo usas)
  entidadId?: string | null;
  entidadEstado?: 'APROBADA' | 'EN_REVISION' | 'RECHAZADA' | 'SIN_ENTIDAD';
};

export default function UserPanel(){
  const nav = useNavigate();
  const [me, setMe] = useState<Me|null>(null);
  const [msg, setMsg] = useState('');

  useEffect(()=> {
    const token = localStorage.getItem('token') || '';
    if(!token) { nav('/'); return; }
    (async ()=>{
      try{
        const r = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const text = await r.text();
        let d: any = {};
        try { d = JSON.parse(text); } catch {}

        if (!r.ok) throw new Error(d?.error || `Falló /api/auth/me (status ${r.status})`);
        setMe(d as Me);
      }catch(err:any){
        setMsg('❌ ' + (err?.message || 'Error de conexión con backend'));
      }
    })();
  }, [nav]);

  if (msg) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6 flex items-center justify-center">
        <div className="bg-[#111827] rounded-2xl p-6 max-w-lg w-full">
          <h1 className="text-xl font-semibold mb-2">Panel de usuario</h1>
          <div className="text-sm">{msg}</div>
          <div className="mt-4 flex gap-2">
            <button className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700"
                    onClick={()=>{ window.location.reload(); }}>
              Reintentar
            </button>
            <button className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700"
                    onClick={()=>{ localStorage.clear(); nav('/'); }}>
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  if(!me){
    return (
      <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6 flex items-center justify-center">
        <div>Cargando panel…</div>
      </div>
    );
  }

  const tieneEntidad = !!me.entidadId;
  const entidadAprobada = me.entidadEstado === 'APROBADA';

  return (
    <div className="min-h-screen bg-[#0B1220] text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Panel de usuario</h1>
            <p className="opacity-80 text-sm">Bienvenido, {me.nombre} · Rol: {me.role}</p>
          </div>
          <button
            onClick={()=>{ localStorage.clear(); window.location.href='/'; }}
            className="px-3 py-2 rounded-xl border border-gray-600 hover:bg-gray-700"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Avisos de estado de entidad */}
        {!tieneEntidad && (
          <div className="mb-4 p-3 rounded-xl bg-blue-900/30 border border-blue-700 text-sm">
            Aún no registraste una entidad. Debes registrar y lograr su aprobación para poder registrar un proyecto.
          </div>
        )}
        {tieneEntidad && me.entidadEstado === 'EN_REVISION' && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-900/30 border border-yellow-700 text-sm">
            Tu entidad está en revisión. El registro de proyecto se habilitará cuando sea aprobada.
          </div>
        )}
        {tieneEntidad && me.entidadEstado === 'RECHAZADA' && (
          <div className="mb-4 p-3 rounded-xl bg-red-900/30 border border-red-700 text-sm">
            Tu entidad fue rechazada. Debes corregir y volver a enviar para aprobación.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Registrar entidad: SOLO si no tiene una */}
          <div className="bg-[#111827] rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">Registro de entidad</h2>
            <p className="text-sm opacity-80 mb-3">Cada usuario puede tener únicamente <b>una</b> entidad.</p>
            <Link
              to={tieneEntidad ? '#' : '/entidad/registrar'}
              className={`inline-block px-4 py-2 rounded-xl ${tieneEntidad ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
              onClick={(e)=>{ if(tieneEntidad){ e.preventDefault(); } }}
              title={tieneEntidad ? 'Ya tienes una entidad registrada' : 'Ir a registrar entidad'}
            >
              {tieneEntidad ? 'Entidad ya registrada' : 'Registrar entidad'}
            </Link>
          </div>

          {/* Registrar proyecto: SOLO si la entidad está APROBADA */}
          <div className="bg-[#111827] rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">Registro de proyecto</h2>
            <p className="text-sm opacity-80 mb-3">Se habilita cuando tu entidad esté <b>aprobada</b>.</p>
            <Link
              to={entidadAprobada ? '/proyecto/registrar' : '#'}
              className={`inline-block px-4 py-2 rounded-xl ${entidadAprobada ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 cursor-not-allowed'}`}
              onClick={(e)=>{ if(!entidadAprobada){ e.preventDefault(); } }}
              title={entidadAprobada ? 'Ir a registrar proyecto' : 'Necesitas una entidad aprobada'}
            >
              {entidadAprobada ? 'Registrar proyecto' : 'Entidad no aprobada'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
