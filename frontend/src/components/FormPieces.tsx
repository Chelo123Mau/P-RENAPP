import React from 'react';

export function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {note && <p className="form-subtitle">{note}</p>}
    </>
  );
}

export function Field({
  label, desc, required, children, full = false,
}: { label: string; desc?: string; required?: boolean; children: React.ReactNode; full?: boolean; }) {
  return (
    <div className={full ? 'field-full' : 'field'}>
      <label className="label">
        {label} {required && <span className="req">*</span>}
      </label>
      {desc && <small className="desc">{desc}</small>}
      {children}
    </div>
  );
}

export function UploadPerField({
  onUpload, accept, multiple = false
}: { onUpload: (files: FileList) => void; accept?: string; multiple?: boolean }) {
  return (
    <div className="help">
      <input
        type="file"
        multiple={multiple}
        accept={accept ?? '.pdf,image/*'}
        onChange={(e) => e.currentTarget.files && onUpload(e.currentTarget.files)}
      />
      <div className="opacity-70 mt-1">Adjuntar respaldo (PDF/imagen)</div>
    </div>
  );
}
