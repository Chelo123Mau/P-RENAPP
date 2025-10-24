
import path from 'path'; import fs from 'fs'; import crypto from 'crypto'; import multer from 'multer';
export const ensureDir=(p:string)=>{if(!fs.existsSync(p))fs.mkdirSync(p,{recursive:true});};
const baseDir=path.join(process.cwd(),'backend','storage','uploads'); ensureDir(baseDir);
const storage=multer.diskStorage({destination:(_req,_file,cb)=>cb(null,baseDir),filename:(_req,file,cb)=>{const stamp=Date.now();const safe=file.originalname.replace(/[^\w.\-]+/g,'_');cb(null,`${stamp}__${safe}`);}});
export const uploader=multer({storage});
export function fileMeta(absPath:string,originalName:string,mimeType:string){const buf=fs.readFileSync(absPath);const hash=crypto.createHash('sha256').update(buf).digest('hex').slice(0,16);const stat=fs.statSync(absPath);return{id:hash,originalName,storagePath:absPath,size:stat.size,mimeType,hash,createdAt:new Date().toISOString()};}
