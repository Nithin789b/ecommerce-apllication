import { tw } from '../lib/tw';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className={tw("site-footer designed-footer")}>
      <div className={tw("footer-benefits")}><div className={tw("flex items-center gap-3 px-4 py-3")}><span className={tw("grid h-8 w-8 shrink-0 place-items-center rounded bg-white text-shop-rust")}>▣</span><p><strong className={tw("block text-xs font-semibold text-shop-ink")}>Cash on delivery</strong><small className={tw("text-[10px] text-shop-muted")}>Pay when your order arrives</small></p></div><div className={tw("flex items-center gap-3 px-4 py-3")}><span className={tw("grid h-8 w-8 shrink-0 place-items-center rounded bg-white text-shop-rust")}>◇</span><p><strong className={tw("block text-xs font-semibold text-shop-ink")}>Considered delivery</strong><small className={tw("text-[10px] text-shop-muted")}>Thoughtful care from bag to doorstep</small></p></div><div className={tw("flex items-center gap-3 px-4 py-3")}><span className={tw("grid h-8 w-8 shrink-0 place-items-center rounded bg-white text-shop-rust")}>↻</span><p><strong className={tw("block text-xs font-semibold text-shop-ink")}>Hassle-free cancellation</strong><small className={tw("text-[10px] text-shop-muted")}>Cancel before processing begins</small></p></div></div>
      <div className={tw("footer-inner page-width")}>
        <div className={tw("footer-links footer-columns")}>
          <div className={tw("flex min-w-36 flex-col gap-2 text-xs")}><h2 className={tw("mb-1 text-[10px] font-bold uppercase tracking-wider text-shop-muted")}>Collections</h2><Link to="/?category=Living%20%26%20Decor">Living &amp; Decor</Link><Link to="/?category=Apparel%20%26%20Linen">Apparel &amp; Linen</Link><Link to="/?category=Kitchenware">Kitchenware</Link></div>
          <div className={tw("flex min-w-36 flex-col gap-2 text-xs")}><h2 className={tw("mb-1 text-[10px] font-bold uppercase tracking-wider text-shop-muted")}>Customer support</h2><Link to="/orders">Track orders</Link><Link to="/account/address">Delivery address</Link><Link to="/orders">Contact support</Link></div>
          <div className={tw("flex min-w-36 flex-col gap-2 text-xs")}><h2 className={tw("mb-1 text-[10px] font-bold uppercase tracking-wider text-shop-muted")}>ShopVerse</h2><Link to="/">Our collection</Link><Link to="/signup">Create account</Link><Link to="/login">Sign in</Link></div>
          <div className={tw("flex min-w-36 flex-col gap-2 text-xs")}><h2 className={tw("mb-1 text-[10px] font-bold uppercase tracking-wider text-shop-muted")}>Merchant portal</h2><Link to="/admin/login">Admin sign in</Link><Link to="/admin">Inventory</Link><Link to="/admin">Fulfilment orders</Link></div>
        </div>
        <div className={tw("footer-bottom")}><span>© {new Date().getFullYear()} ShopVerse. Made for everyday moments.</span><span>Privacy　 Terms　 Accessibility</span></div>
      </div>
    </footer>
  );
}
export default Footer;
