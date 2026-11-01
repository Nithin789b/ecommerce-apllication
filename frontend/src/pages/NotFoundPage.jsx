import { tw } from '../lib/tw';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className={tw("page-placeholder page-width")}>
      <p className={tw("eyebrow")}>404</p>
      <h1>We couldn't find that page.</h1>
      <p>It may have moved, or the address may be incorrect.</p>
      <Link className={tw("button button-primary")} to="/">Back to shop</Link>
    </section>
  );
}
export default NotFoundPage;
