
import React,{createContext,useContext,useEffect,useState}from'react';
type User={id:string;email:string;role:'user'|'admin'|'reviewer';nombre:string;approved:string;entidadId?:string|null};
type AuthCtx={token:string|null;user:User|null;login:(email:string,password:string)=>Promise<void>;logout:()=>void;refresh:()=>Promise<void>};
const Ctx=createContext<AuthCtx>(null as any);
export function AuthUserProvider({children}:{children:React.ReactNode}){
  const [token,setToken]=useState<string|null>(null); const [user,setUser]=useState<User|null>(null);
  useEffect(()=>{const t=localStorage.getItem('token'); if(t){setToken(t); (async()=>{await refreshToken(t);})();}},[]);
  async function refreshToken(tkn:string){try{const r=await fetch('/api/auth/me',{headers:{Authorization:`Bearer ${tkn}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error||'ME error');setUser(d);setToken(tkn);}catch{setUser(null);setToken(null);localStorage.removeItem('token');}}
  async function login(email:string,password:string){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d?.error||'Login error');localStorage.setItem('token',d.token);await refreshToken(d.token);if(d.user?.role==='admin')window.location.href='/admin/panel';if(d.user?.role==='reviewer')window.location.href='/review/panel';}
  function logout(){localStorage.removeItem('token');setToken(null);setUser(null);window.location.href='/';}
  async function refresh(){if(token)await refreshToken(token);}
  return <Ctx.Provider value={{token,user,login,logout,refresh}}>{children}</Ctx.Provider>;
}
export function useUserAuth(){return useContext(Ctx);}
