import type { ReactNode } from 'react';

interface Props {
  onBack?: () => void;
  backLabel?: string;
  /** 1-based step within a segmented progress bar of `total`. */
  progress?: { step: number; total: number };
  footer?: ReactNode;
  children: ReactNode;
}

/** One mobile screen: back chevron, segmented progress, content, pinned primary action. */
export default function Screen({ onBack, backLabel = 'Back', progress, footer, children }: Props) {
  return (
    <div className="screen">
      <div className="nav">{onBack && <button className="back" onClick={onBack}>{backLabel}</button>}</div>
      {progress && (
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.step}>
          {Array.from({ length: progress.total }, (_, i) => <div key={i} className={'seg' + (i < progress.step ? ' on' : '')} />)}
        </div>
      )}
      <main>{children}</main>
      {footer && <footer className="cta-bar">{footer}</footer>}
    </div>
  );
}
