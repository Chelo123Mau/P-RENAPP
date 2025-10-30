"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarReportePorEmail = enviarReportePorEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function enviarReportePorEmail(to, subject, text, attachmentPath) { const transporter = nodemailer_1.default.createTransport({ jsonTransport: true }); const message = { from: 'no-reply@renapp.local', to, subject, text }; if (attachmentPath)
    message.attachments = [{ filename: 'reporte.pdf', path: attachmentPath }]; const info = await transporter.sendMail(message); console.log('Email simulado enviado:', info.messageId || info); }
