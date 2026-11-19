"use client";

export type ToastAction = {
  label: string;
  undo: () => void | Promise<void>;
  undoLabel?: string;
  extra?: {
    label: string;
    run: () => void | Promise<void>;
  };
};

export function ActionToast({
  toast,
  onDismiss,
}: {
  toast: ToastAction | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-enter fixed bottom-24 right-4 z-30 overflow-hidden rounded-2xl border border-line-strong bg-card text-sm font-medium shadow-xl md:bottom-6 md:right-6"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span>{toast.label}</span>
        {toast.extra && (
          <button
            type="button"
            onClick={() => {
              const run = toast.extra!.run;
              onDismiss();
              void run();
            }}
            className="btn spring-btn min-h-9 px-3 py-1 text-xs"
          >
            {toast.extra.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const undo = toast.undo;
            onDismiss();
            void undo();
          }}
          className="btn btn-primary spring-btn min-h-9 px-3 py-1 text-xs"
        >
          {toast.undoLabel ?? "Desfazer"}
        </button>
      </div>
      <div className="h-1 w-full bg-line">
        <div key={toast.label} className="toast-bar h-full bg-primary" />
      </div>
    </div>
  );
}
