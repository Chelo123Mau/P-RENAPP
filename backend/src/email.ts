
import nodemailer from 'nodemailer';
export async function enviarReportePorEmail(to:string,subject:string,text:string,attachmentPath?:string){const transporter=nodemailer.createTransport({jsonTransport:true});const message:any={from:'no-reply@renapp.local',to,subject,text};if(attachmentPath)message.attachments=[{filename:'reporte.pdf',path:attachmentPath}];const info=await transporter.sendMail(message);console.log('Email simulado enviado:',info.messageId||info);}
