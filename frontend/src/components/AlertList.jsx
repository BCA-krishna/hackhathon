export default function AlertList({ alerts }) {
  if (!alerts?.length) {
    return <p className="text-sm text-slate-400">No active alerts.</p>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert._id} className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-200">{alert.type.replace('_', ' ')}</p>
          <p className="text-sm text-slate-200">{alert.message}</p>
          <p className="mt-1 text-xs text-slate-400">Severity: {alert.severity}</p>
        </div>
      ))}
    </div>
  );
}
