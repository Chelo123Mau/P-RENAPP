"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarPDFReporte = generarPDFReporte;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
function generarPDFReporte(destBaseDir, folio, titulo, cuerpo) { if (!fs_1.default.existsSync(destBaseDir))
    fs_1.default.mkdirSync(destBaseDir, { recursive: true }); const filePath = path_1.default.join(destBaseDir, `${folio}.pdf`); const doc = new pdfkit_1.default({ size: 'A4', margin: 50 }); doc.pipe(fs_1.default.createWriteStream(filePath)); doc.fontSize(18).text(titulo, { align: 'center' }); doc.moveDown(); doc.fontSize(12).text(cuerpo, { align: 'left' }); doc.end(); return filePath; }
