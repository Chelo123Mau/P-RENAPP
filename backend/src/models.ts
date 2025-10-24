
export type UUID = string;
export enum ApproveState { PENDIENTE='PENDIENTE', APROBADO='APROBADO', RECHAZADO='RECHAZADO' }
export enum DraftState { DRAFT='DRAFT', SUBMITTED='SUBMITTED' }
export enum Estado { REVISION='REVISION', APROBADO='APROBADO', OBSERVADO='OBSERVADO' }
export enum RefTipo { USUARIO='USUARIO', ENTIDAD='ENTIDAD', PROYECTO='PROYECTO' }
export enum ReportTipo { APROBACION='APROBACION', OBSERVACIONES='OBSERVACIONES' }
export interface Archivo { id:string; originalName:string; storagePath:string; size:number; mimeType:string; hash:string; createdAt:string; }
export interface ApprovalMeta { approvedByRole:'admin'|'reviewer'; approvedByUser:string; approvedAt:string; }
export interface User { id:UUID; email:string; password:string; nombre:string; role:'user'|'admin'|'reviewer'; approved:ApproveState; entidadId?:UUID; }
export interface Entidad { id:UUID; nombre:string; nit?:string; representante?:string; ownerUserId:UUID; approved:ApproveState; createdAt:string; draftState?:DraftState; approvalMeta?:ApprovalMeta; documentos?:Archivo[]; extras?:Record<string,any>; docsPorCampo?:Record<string,Archivo[]>; }
export interface Proyecto { id:UUID; nombre:string; entidadId:UUID; ownerUserId:UUID; approved:ApproveState; createdAt:string; draftState?:DraftState; approvalMeta?:ApprovalMeta; documentos?:Archivo[]; extras?:Record<string,any>; docsPorCampo?:Record<string,Archivo[]>; }
export interface CampoKV { key:string; label:string; value:string; }
export interface Reporte { id:UUID; tipo:ReportTipo; folio:string; createdAt:string; pdfPath?:string; comentario?:string; }
export interface RegistroBase { id:UUID; tipo:RefTipo; solicitanteNombre:string; solicitanteEmail:string; entidadNombre?:string; estado:Estado; enviadaAt:string; formulario:{campos:CampoKV[]; documentos:Archivo[]; docsPorCampo?:Record<string,Archivo[]>;}; reportes:Reporte[]; }
export interface DB { users:Map<UUID,User>; entidades:Map<UUID,Entidad>; proyectos:Map<UUID,Proyecto>; registros:Map<UUID,RegistroBase>; }
