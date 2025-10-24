import { authJson } from "../api";

type Scope = "user" | "entity" | "project";
type Decision = "approve" | "observe";

export async function generateReviewPdfAndSend({
  scope,
  target,          // objeto con lo que el revisor está viendo (datos del registro)
  targetId,        // id del user/entity/project según corresponda
  decision,        // "approve" | "observe"
  comments,        // texto libre del informe
  reviewerName,    // opcional, para firmar el informe
  setMsg,          // setState para mostrar estado en UI
}: {
  scope: Scope;
  target: any;
  targetId: string;
  decision: Decision;
  comments: string;
  reviewerName?: string;
  setMsg: (s: string) => void;
}) {
  // 1) Preparar snapshot para el PDF
  const title =
    scope === "user" ? `Informe revisión — Registro de usuario` :
    scope === "entity" ? `Informe revisión — Entidad` :
    `Informe revisión — Proyecto`;

  const snapshot = {
    decision: decision === "approve" ? "APROBADO" : "OBSERVACIONES",
    reviewer: reviewerName || "Revisor RENAPP",
    date: new Date().toISOString(),
    comments,
    data: target?.data || target || {},
  };

  // 2) Generar PDF en servidor y obtener url
  setMsg("Generando informe PDF…");
  const pdf = await authJson("/api/pdf/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, scope, action: "review-report", snapshot }),
  });
  if (!pdf.ok || !pdf.data?.pdfUrl) {
    setMsg("❌ No se pudo generar el PDF del informe");
    throw new Error(pdf.data?.error || `Error PDF ${pdf.status}`);
  }
  const pdfUrl = pdf.data.pdfUrl as string;

  // 3) Disparar endpoint de revisión correspondiente (adjuntando pdfUrl)
  setMsg(decision === "approve" ? "Enviando aprobación…" : "Enviando observaciones…");
  const path =
    scope === "user"
      ? `/api/review/users/${targetId}/${decision}`
      : scope === "entity"
      ? `/api/review/entities/${targetId}/${decision}`
      : `/api/review/projects/${targetId}/${decision}`;

  const r = await authJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comments, pdfUrl }),
  });

  if (!r.ok) {
    setMsg("❌ No se pudo enviar el informe");
    throw new Error(r.data?.error || `Error ${r.status}`);
  }

  setMsg("✅ Informe enviado y notificado al usuario");
  // 4) (Opcional) abrir el PDF del informe en nueva pestaña
  window.open(pdfUrl, "_blank", "noopener,noreferrer");
}
