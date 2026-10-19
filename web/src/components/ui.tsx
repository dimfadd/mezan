import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCw, X } from "lucide-react";
import { initials } from "../lib/format";

// ---------- Dialog ----------
// Pakai <dialog> bawaan browser: fokus terkunci di dalam, Escape menutup, aman untuk pembaca layar.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  label,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""} ${className}`}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          {title && (
            <div className="modal-head">
              <h2 id={titleId}>{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
                <X />
              </button>
            </div>
          )}
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

// ---------- Konfirmasi ----------
type ConfirmOpts = { title: string; body?: ReactNode; confirm: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        footer={
          <>
            <button className="btn" onClick={() => close(false)}>
              Batal
            </button>
            <button className={`btn ${state?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} autoFocus>
              {state?.confirm}
            </button>
          </>
        }
      >
        {typeof state?.body === "string" ? <p>{state.body}</p> : state?.body}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---------- Toast ----------
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Field ----------
export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className="switch" style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span className="switch-text">
        <span className="strong">{label}</span>
        {hint && <span className="small muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MoneyInput({ id, value, onChange, required }: { id?: string; value: number | ""; onChange: (v: number | "") => void; required?: boolean }) {
  return (
    <div className="input-prefix">
      <span>Rp</span>
      <input
        id={id}
        className="input num"
        inputMode="numeric"
        required={required}
        value={value === "" ? "" : new Intl.NumberFormat("id-ID").format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits === "" ? "" : Math.min(Number(digits), 1_000_000_000));
        }}
      />
    </div>
  );
}

// ---------- State ----------
export function Empty({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      {icon ?? <Inbox aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Data belum bisa dimuat", retryLabel = "Coba lagi" }: { message: string; onRetry?: () => void; title?: string; retryLabel?: string }) {
  return (
    <div className="state error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <RotateCw /> {retryLabel}
        </button>
      )}
    </div>
  );
}

export function Loading({ rows = 3, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

// ---------- Media ----------
export function Thumb({ image, video, name, autoPlay }: { image?: string | null; video?: string | null; name: string; autoPlay?: boolean }) {
  if (video && autoPlay) {
    return <video src={video} poster={image ?? undefined} muted loop playsInline autoPlay preload="metadata" aria-label={name} />;
  }
  if (image) return <img src={image} alt="" loading="lazy" decoding="async" />;
  // Tanpa foto: tampilkan inisial, bukan gambar stok palsu.
  return (
    <div className="ph" aria-hidden="true">
      {initials(name)}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
