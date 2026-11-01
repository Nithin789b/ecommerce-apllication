import { tw } from '../../lib/tw';
function EmptyState({ title, message, action = null }) {
  return (
    <section className={tw("empty-state")}>
      <span className={tw("empty-state-mark")} aria-hidden="true">✳</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
export default EmptyState;
