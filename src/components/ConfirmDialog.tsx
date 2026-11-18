"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { MenuItem } from "@/types/menu";

type Props = {
  item: MenuItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  item,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (item && !dialog.open) {
      dialog.showModal();
    }

    if (!item && dialog.open) {
      dialog.close();
    }
  }, [item]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      onCancel={(event) => {
        if (busy) {
          event.preventDefault();
        } else {
          onCancel();
        }
      }}
      onClose={() => {
        if (item && !busy) {
          onCancel();
        }
      }}
    >
      <div className="dialog-inner">
        <button
          type="button"
          className="dialog-close"
          aria-label="Close dialog"
          onClick={onCancel}
          disabled={busy}
        >
          <X size={20} />
        </button>

        <div className="dialog-icon">
          <AlertTriangle size={25} />
        </div>

        <h3 id="delete-dialog-title">
          Remove this dish?
        </h3>

        <p id="delete-dialog-description">
          Are you sure you want to remove{" "}
          <strong>{item?.name}</strong> from the menu?
          This action cannot be undone.
        </p>

        <div className="dialog-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onCancel}
            disabled={busy}
          >
            Keep dish
          </button>

          <button
            type="button"
            className="button button-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Removing..." : "Yes, remove"}
          </button>
        </div>
      </div>
    </dialog>
  );
}