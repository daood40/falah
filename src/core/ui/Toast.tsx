/** Toast/snackbar system + global AppError listener. */
import { useEffect } from 'react';
import { create } from 'zustand';
import { onAppError } from '../errors/errors';
import { useI18n } from '../i18n';
import { newId } from '../utils/id';
import { IconClose } from './icons';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
}

interface ToastState {
  toasts: ToastItem[];
  show: (kind: ToastKind, text: string) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (kind, text) => {
    const item: ToastItem = { id: newId(), kind, text };
    set((s) => ({ toasts: [...s.toasts.slice(-2), item] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== item.id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(kind: ToastKind, text: string): void {
  useToasts.getState().show(kind, text);
}

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  const t = useI18n((s) => s.t);

  // Surface AppErrors as friendly translated toasts.
  useEffect(
    () =>
      onAppError((error) => {
        useToasts.getState().show('error', t(error.messageKey));
      }),
    [t],
  );

  if (toasts.length === 0) return null;
  return (
    <div className="fl-toasts" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`fl-toast fl-toast--${item.kind}`}>
          <span className="fl-grow">{item.text}</span>
          <button
            className="fl-btn fl-btn--ghost fl-btn--sm"
            onClick={() => dismiss(item.id)}
            aria-label={t('common.close')}
          >
            <IconClose size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
