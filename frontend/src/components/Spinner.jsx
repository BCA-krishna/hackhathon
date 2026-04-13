export default function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center gap-3 text-slate-200">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
