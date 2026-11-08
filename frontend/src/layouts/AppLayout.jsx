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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${drawer ? 'has-bottom-nav' : ''}`}>
      <aside className="sidebar" inert={drawer ? '' : undefined} aria-label="Main navigation">
        <div className="sidebar-logo">
          <BrandLockup />
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
          <span className="topbar-title">{links.find(link => link.to === location.pathname)?.label || 'Snack Time POS'}</span>
          <div className="topbar-date">
            <CalendarDays size={16} />
            <time dateTime={new Date().toISOString()}>
              <span className="date-full">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="date-compact">{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
            </time>
          </div>
        </header>
        <SyncIndicator revealRequest={syncRequest} />
        <div className={`page-body ${isPos ? 'page-body-pos' : ''}`}>
          <Outlet />
        </div>
      </div>
      {drawer && <MobileNavigation links={links} user={user} android={android} open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} onLogout={handleLogout} onSync={() => { setMenuOpen(false); setSyncRequest(value => value + 1); }} />}
    </div>
  );
}
