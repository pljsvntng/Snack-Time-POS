import { useState, useEffect } from 'react';
import useMediaQuery from '../hooks/useMediaQuery';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Tag, Boxes, ReceiptText, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, LogOut, User, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Brand';
import SyncIndicator from '../components/SyncIndicator';
import MobileNavigation from '../components/MobileNavigation';

const ADMIN_LINKS = [
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Tag, label: 'Products' },
  { to: '/inventory', icon: Boxes, label: 'Inventory' },
  { to: '/transactions', icon: ReceiptText, label: 'Transactions' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/users', icon: UsersIcon, label: 'Users' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

const CASHIER_LINKS = [
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/transactions', icon: ReceiptText, label: 'My Transactions' },
];

export default function AppLayout() {
  const { user, logout, android } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncRequest, setSyncRequest] = useState(0);

  const narrowNavigation = useMediaQuery('(max-width: 1199px)');
  const drawer = android || narrowNavigation;
  useEffect(() => { if (!drawer) setMenuOpen(false); }, [drawer]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const links = user?.role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;
  const isPos = location.pathname === '/pos';
  const isCashier = user?.role === 'cashier';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`app-shell horizontal-shell ${drawer ? 'has-bottom-nav' : ''} ${isCashier ? 'cashier-shell' : 'admin-shell'}`}>
      <div className="main-content" inert={drawer && menuOpen ? '' : undefined}>
        <header className="topbar workspace-header">
          <div className="workspace-brand"><BrandLockup size={36} /></div>
          {!drawer && <nav className="workspace-top-nav" aria-label={isCashier ? 'Cashier navigation' : 'Administrator navigation'}>
            {links.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'workspace-nav-link active' : 'workspace-nav-link'}><Icon size={16} /><span>{to === '/pos' ? 'POS' : isCashier ? 'Transaction history' : label}</span></NavLink>)}
          </nav>}
          <div className="workspace-account">
            <span className="sidebar-avatar"><User size={17} /></span>
            <div className="workspace-user"><b>{user?.fullName}</b><small>{user?.offline ? 'Offline cash register' : isCashier ? 'Cashier' : 'Administrator'}</small></div>
            <time className="workspace-date" dateTime={new Date().toISOString()} title={new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}><CalendarDays size={14} />{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</time>
            {!drawer && <button className="btn btn-ghost workspace-logout" onClick={handleLogout} aria-label="Log out"><LogOut size={18} /></button>}
          </div>
        </header>
        <SyncIndicator revealRequest={syncRequest} />
        <div className={`page-body ${isPos ? 'page-body-pos' : ''}`}><Outlet /></div>
      </div>
      {drawer && <MobileNavigation links={links} user={user} android={android} open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} onLogout={handleLogout} onSync={() => { setMenuOpen(false); setSyncRequest(value => value + 1); }} />}
    </div>
  );
}
