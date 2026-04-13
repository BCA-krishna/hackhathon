import { useState } from 'react';

export default function SettingsPage() {
  const [profile, setProfile] = useState({ fullName: 'Business Owner', email: 'owner@business.com' });
  const [settings, setSettings] = useState({
    lowStockAlerts: true,
    salesDropAlerts: true,
    weeklySummary: false,
    compactDataView: false
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your account and preferences</p>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Profile Info</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={profile.fullName}
            onChange={(event) => setProfile((prev) => ({ ...prev, fullName: event.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          />
          <input
            value={profile.email}
            onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
        <div className="mt-4 space-y-3">
          {[
            ['lowStockAlerts', 'Low stock notifications'],
            ['salesDropAlerts', 'Sales drop alerts'],
            ['weeklySummary', 'Weekly summary report']
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
              <span className="text-sm text-slate-200">{label}</span>
              <button
                type="button"
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 rounded-full transition ${settings[key] ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    settings[key] ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Data Preferences</h2>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
          <span className="text-sm text-slate-200">Compact data view</span>
          <button
            type="button"
            onClick={() => toggle('compactDataView')}
            className={`relative h-6 w-11 rounded-full transition ${settings.compactDataView ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                settings.compactDataView ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onSave} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950">
          Save
        </button>
        {saved ? <span className="text-sm text-emerald-300">Preferences saved.</span> : null}
      </div>
    </div>
  );
}
