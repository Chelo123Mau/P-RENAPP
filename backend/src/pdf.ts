
import path from 'path'; import fs from 'fs'; import PDFDocument from 'pdfkit';
export function generarPDFReporte(destBaseDir:string,folio:string,titulo:string,cuerpo:string){if(!fs.existsSync(destBaseDir))fs.mkdirSync(destBaseDir,{recursive:true});const filePath=path.join(destBaseDir,`${folio}.pdf`);const doc=new PDFDocument({size:'A4',margin:50});doc.pipe(fs.createWriteStream(filePath));doc.fontSize(18).text(titulo,{align:'center'});doc.moveDown();doc.fontSize(12).text(cuerpo,{align:'left'});doc.end();return filePath;}
