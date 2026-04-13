import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload', label: 'Upload' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/settings', label: 'Settings' }
];

export default function AppLayout() {
  const location = useLocation();
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-transparent text-white">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="border-b border-slate-800 bg-slate-950/60 p-4 backdrop-blur md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-5">
          <div>
            <p className="text-lg font-bold tracking-tight text-white">Decision Support</p>
            <p className="text-xs text-slate-400">Business Intelligence Suite</p>
          </div>

          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:mt-8 md:grid-cols-1">
            {links.map((link, idx) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                    active
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                      : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/55 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Welcome,</p>
                <p className="text-base font-semibold text-white">{user?.name || 'User'}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 sm:block">
                  {user?.email}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="min-h-[calc(100vh-72px)] px-4 py-5 md:px-6 md:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
