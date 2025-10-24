
import React,{useRef}from'react'; type Archivo={id:string;originalName:string;storagePath:string;size:number;mimeType:string;hash:string;createdAt:string};
export default function FieldUpload({token,fieldKey,files,onChange}:{token?:string|null;fieldKey:string;files:Archivo[];onChange:(list:Archivo[])=>void;}){
  const ref=useRef<HTMLInputElement|null>(null);
  const doUpload=async(fl:FileList)=>{const fd=new FormData();Array.from(fl).forEach(f=>fd.append('files',f));const r=await fetch('/api/upload',{method:'POST',headers:token?{Authorization:`Bearer ${token}`} : undefined,body:fd});const d=await r.json();if(!r.ok)throw new Error(d?.error||'No se pudo subir');onChange([...(files||[]),...d.files]);};
  return(<div style={{display:'inline-flex',alignItems:'center',gap:8}}><button type='button' onClick={()=>ref.current?.click()} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #374151'}}>Adjuntar respaldo</button><input type='file' hidden ref={ref} multiple onChange={e=>e.target.files&&doUpload(e.target.files)} />{files?.length?<span style={{fontSize:12,opacity:.8}}>{files.length} archivo(s)</span>:null}</div>);
}
