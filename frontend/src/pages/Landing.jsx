import { Link } from 'react-router-dom';
import Button3D from '../components/Button3D';
import LandingPatternBackground from '../components/LandingPatternBackground';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LandingPatternBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-3xl rounded-3xl border border-white/20 bg-slate-900/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-sm md:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Our Project</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl">
            Real-Time Decision Support System
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-200 md:text-base">
            Smart insights for sales, inventory, and forecasting to help businesses make better decisions faster.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button3D color1="#06b6d4" color2="#0e7490">Get Started</Button3D>
            </Link>
            <Link to="/dashboard">
              <Button3D color1="#16a34a" color2="#14532d">View Dashboard</Button3D>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
