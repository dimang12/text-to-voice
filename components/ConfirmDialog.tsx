"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, danger, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="dialog-panel" role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-body">
        <div className={`dialog-icon ${danger ? "danger" : ""}`} aria-hidden="true">
          {danger ? (
            <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          )}
        </div>
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-body">{body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel} autoFocus disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
