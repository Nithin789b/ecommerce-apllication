import { tw } from '../lib/tw';
import { Link } from 'react-router-dom';

function AdminSidebar() {
  return <aside className={tw("admin-sidebar")}><span className={tw("admin-sidebar-label")}>Navigation</span><a href="#admin-products">▣ Products &amp; Inventory</a><a href="#admin-orders">▤ Order Management</a><a href="#admin-summary">▥ Store Analytics</a><a href="#admin-settings">⚙ Admin Settings</a><Link to="/">↗ Switch to Storefront</Link></aside>;
}

export default AdminSidebar;
