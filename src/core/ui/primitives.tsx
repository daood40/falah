/** Shared UI primitives: modal, confirm dialog, empty/error states, spinner, field. */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { IconClose } from './icons';

export function Modal({
  open,
  onClose,
  title,
  children,
  sheet = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  sheet?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const body = (
    <div
      className={sheet ? 'fl-sheet' : 'fl-modal'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="fl-row" style={{ marginBottom: 'var(--fl-sp-4)' }}>
        <h2 className="fl-title fl-grow">{title}</h2>
        <button className="fl-btn fl-btn--ghost fl-btn--icon" onClick={onClose} aria-label="close">
          <IconClose size={18} />
        </button>
      </div>
      {children}
    </div>
  );
  if (sheet) {
    return (
      <>
        <div className="fl-overlay" style={{ padding: 0 }} onClick={onClose} />
        {body}
      </>
    );
  }
  return (
    <div className="fl-overlay" onClick={onClose}>
      {body}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p style={{ marginBottom: 'var(--fl-sp-5)' }}>{text}</p>
      <div className="fl-row" style={{ justifyContent: 'flex-end' }}>
        <button className="fl-btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          className={`fl-btn ${danger ? 'fl-btn--danger' : 'fl-btn--primary'}`}
          onClick={onConfirm}
        >
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}

export function EmptyState({
  icon = '📭',
  text,
  action,
}: {
  icon?: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="fl-state">
      <div className="fl-state__icon" aria-hidden>
        {icon}
      </div>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const t = useI18n((s) => s.t);
  return (
    <div className="fl-state" role="alert">
      <div className="fl-state__icon" aria-hidden>
        ⚠️
      </div>
      <p>{text}</p>
      {onRetry && (
        <button className="fl-btn fl-btn--primary" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="fl-state">
      <div className="fl-spin" aria-hidden />
      {label && <p className="fl-muted">{label}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="fl-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SkeletonList({ count = 4, height = 72 }: { count?: number; height?: number }) {
  return (
    <div className="fl-col">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="fl-skeleton" style={{ height }} />
      ))}
    </div>
  );
}
