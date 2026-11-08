import { useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Tag, ReceiptText, Menu, X, User, LogOut, RefreshCw } from 'lucide-react';
import useFocusLayer from '../hooks/useFocusLayer';

const PRIMARY = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/products', icon: Tag, label: 'Products' },
  { to: '/transactions', icon: ReceiptText, label: 'History' },
];

export default function MobileNavigation({ links, user, android, open, onOpen, onClose, onLogout, onSync }) {
  const sheet = useRef(null);
  const location = useLocation();
  useFocusLayer(sheet, open, onClose);
  const primary = PRIMARY.filter(item => links.some(link => link.to === item.to));
  const more = links.filter(link => !PRIMARY.some(item => item.to === link.to));
  const moreActive = more.some(link => link.to === location.pathname);

  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation" inert={open ? '' : undefined}>
      {primary.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <span className="bottom-nav-icon"><Icon size={21} aria-hidden="true" /></span><span>{label}</span>
      </NavLink>)}
      <button type="button" className={`bottom-nav-item ${moreActive || open ? 'active' : ''}`} aria-label="More" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-more-menu" onClick={onOpen}>
        <span className="bottom-nav-icon"><Menu size={21} aria-hidden="true" /></span><span>More</span>
      </button>
    </nav>
    {open && <div className="mobile-more-overlay" onClick={onClose}>
      <section id="mobile-more-menu" ref={sheet} className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-menu-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
        <header className="more-menu-header"><h2 id="more-menu-title">More</h2><button type="button" className="more-menu-close" aria-label="Close More menu" onClick={onClose}><X size={21} /></button></header>
        <div className="more-menu-content">
          <div className="more-menu-account"><User size={22} aria-hidden="true" /><div><b>{user?.fullName || user?.username}</b><span>{user?.role === 'admin' ? 'Administrator' : 'Cashier'}{user?.username ? ` · ${user.username}` : ''}</span></div></div>
          <nav aria-label="More sections">
            {more.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} className={({ isActive }) => `more-menu-item ${isActive ? 'active' : ''}`} onClick={onClose}><Icon size={21} aria-hidden="true" /><span>{label}</span></NavLink>)}
          </nav>
          {android && <button type="button" className="more-menu-item" onClick={onSync}><RefreshCw size={21} aria-hidden="true" /><span>Synchronization status</span></button>}
          <button type="button" className="more-menu-item more-menu-logout" onClick={onLogout}><LogOut size={21} aria-hidden="true" /><span>Log out</span></button>
        </div>
      </section>
    </div>}
  </>;
}
