export default function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-panel/80 p-4 shadow-lg shadow-black/10">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
