export default function RecommendationList({ recommendations }) {
  if (!recommendations?.length) {
    return <p className="text-sm text-slate-400">No recommendations yet.</p>;
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, idx) => (
        <div key={`${rec.productName}-${idx}`} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
          <p className="text-sm font-semibold text-emerald-200">{rec.action}</p>
          <p className="text-sm text-slate-200">{rec.productName}</p>
          <p className="text-xs text-slate-400">{rec.reason}</p>
        </div>
      ))}
    </div>
  );
}
