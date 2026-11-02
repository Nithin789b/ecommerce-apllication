import { tw } from '../../lib/tw';

function LoadingSpinner({ label = 'Loading', size = 'medium' }) {
  return (
    <div className={tw("loading-state")} role="status" aria-live="polite">
      <span className={tw('loading-spinner loading-spinner-' + size)} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default LoadingSpinner;
