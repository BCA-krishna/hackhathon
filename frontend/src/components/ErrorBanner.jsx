export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
      {message}
    </div>
  );
}
