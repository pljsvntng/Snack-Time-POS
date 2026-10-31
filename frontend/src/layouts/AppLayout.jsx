import { useState, useRef, useEffect } from 'react';
import useMediaQuery from '../hooks/useMediaQuery';
import useFocusLayer from '../hooks/useFocusLayer';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Tag, Boxes, ReceiptText, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, LogOut, Menu, X, User, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Brand';
import SyncIndicator from '../components/SyncIndicator';

const ADMIN_LINKS = [
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Tag, label: 'Products' },
  { to: '/inventory', icon: Boxes, label: 'Inventory' },
  { to: '/transactions', icon: ReceiptText, label: 'Orders' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/users', icon: UsersIcon, label: 'Users' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

const CASHIER_LINKS = [
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/transactions', icon: ReceiptText, label: 'My Transactions' },
];

export default function AppLayout() {
  const { user, logout, android, offline, offlineStatus, switchMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const drawer = useMediaQuery('(max-width: 1199px)');
  const navigationRef = useRef(null);
  useFocusLayer(navigationRef, drawer && menuOpen, () => setMenuOpen(false));
  useEffect(() => { if (!drawer) setMenuOpen(false); }, [drawer]);

  const links = user?.role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;
  const isPos = location.pathname === '/pos';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside id="navigation-drawer" ref={navigationRef} className={`sidebar ${menuOpen ? 'open' : ''}`} inert={drawer && !menuOpen ? '' : undefined} role={drawer ? 'dialog' : undefined} aria-modal={drawer && menuOpen ? true : undefined} aria-label="Main navigation" tabIndex={-1}>
        <div className="sidebar-logo">
          <BrandLockup />
          <button className="navigation-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="POS sections">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar"><User size={16} /></span>
            <div style={{ minWidth: 0 }}>
              <b>{user?.fullName}</b>
              {user?.role === 'admin' ? 'Administrator' : 'Cashier'}
            </div>
          </div>
          <button className="btn btn-outline btn-block" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      <div className="main-content" inert={drawer && menuOpen ? '' : undefined}>
        <header className="topbar">
          <button className="mobile-menu-btn" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="navigation-drawer" onClick={() => setMenuOpen((o) => !o)}>
            <Menu size={20} />
          </button>
          <span className="topbar-title">{links.find(link => link.to === location.pathname)?.label || 'Snack Time POS'}</span>
          <div className="topbar-date">
            <CalendarDays size={16} />
            <time dateTime={new Date().toISOString()}>
              <span className="date-full">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="date-compact">{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
            </time>
          </div>
        </header>
        <div className={`page-body ${isPos ? 'page-body-pos' : ''}`}>
          <SyncIndicator />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
