import { tw } from '../../lib/tw';
function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null;
  return (
    <nav className={tw("pagination")} aria-label="Product pages">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span>Page <strong>{page}</strong> of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
    </nav>
  );
}
export default Pagination;
