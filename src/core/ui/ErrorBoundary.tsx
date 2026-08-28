/** Top-level error boundary: logs technical details, shows a friendly recovery UI. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate, useI18n } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Technical log only — the user sees a translated, generic message.
    console.error('[FALAH:boundary]', error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    const locale = useI18n.getState().locale;
    return (
      <div className="fl-state" role="alert" style={{ minHeight: '60vh' }}>
        <div className="fl-state__icon" aria-hidden>
          ⚠
        </div>
        <p>{translate(locale, 'errors.unknown')}</p>
        <button className="fl-btn fl-btn--primary" onClick={() => window.location.assign('/')}>
          {translate(locale, 'common.retry')}
        </button>
      </div>
    );
  }
}
