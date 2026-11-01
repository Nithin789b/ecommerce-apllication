import { tw } from '../lib/tw';
import { Outlet } from 'react-router-dom';
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';
import AdminSidebar from './AdminSidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function Layout() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  return <div className={tw('app-shell' + (isAdmin ? ' app-shell-admin' : ''))}><Navbar />{isAdmin ? <div className={tw("admin-body")}><AdminSidebar /><main id="main-content" className={tw("main-content")}><Outlet /></main></div> : <main id="main-content" className={tw("main-content")}><Outlet /></main>}{!isAdmin && <Footer />}</div>;
}
export default Layout;
