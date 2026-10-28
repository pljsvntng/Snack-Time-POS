import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Tag, Boxes, ReceiptText, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, LogOut, Menu, User, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Brand';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = user?.role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;
  const isPos = location.pathname === '/pos';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <BrandLockup />
        </div>
        <nav className="sidebar-nav">
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

      <div className="main-content">
        <header className="topbar">
          <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setMenuOpen((o) => !o)}>
            <Menu size={20} />
          </button>
          <div />
          <div className="topbar-date">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <div className={`page-body ${isPos ? 'page-body-pos' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
