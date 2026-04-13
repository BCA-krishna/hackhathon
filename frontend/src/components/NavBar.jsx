import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload', label: 'Upload Data' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/alerts', label: 'Alerts' }
];

export default function NavBar() {
  const location = useLocation();
  const { logout, user } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-base/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-lg font-bold text-white">Decision Support</p>
          <p className="text-xs text-slate-400">Real-time business intelligence</p>
        </div>

        <nav className="hidden gap-2 md:flex">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-accent text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-slate-300 sm:block">{user?.name}</p>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
