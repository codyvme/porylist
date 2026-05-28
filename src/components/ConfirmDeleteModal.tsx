import { useEffect } from "react";

export function ConfirmDeleteModal({
  title,
  subject,
  onConfirm,
  onCancel,
}: {
  title: string;
  subject: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-xl bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        <h2 id="confirm-delete-title" className="mb-2 text-lg font-semibold">{title}</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Permanently delete <strong className="text-foreground">{subject}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
