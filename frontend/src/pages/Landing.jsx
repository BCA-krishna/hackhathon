import { Link } from 'react-router-dom';
import LandingPatternBackground from '../components/LandingPatternBackground';
import redorbVideo from '../assets/redorb.mp4';

const featurePills = [
  'AI-Based Forecasting',
  'Automated Recommendations',
  'Visual Analytics Dashboards',
  'Smart Anomaly Alerts'
];

const outputCards = [
  { title: 'Business Insights', detail: 'Live metrics and clear operating signals' },
  { title: 'Forecast Reports', detail: 'Projected sales trends with confidence bands' },
  { title: 'Performance Analytics', detail: 'Cross-product and daily movement tracking' },
  { title: 'Recommendations', detail: 'Actionable next steps for rapid execution' }
];

export default function LandingPage() {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#030304] px-3 py-4 font-body sm:px-6 sm:py-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-70" />
      <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#ea580c]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-12 h-80 w-80 rounded-full bg-[#ffd600]/15 blur-[130px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-7xl flex-col gap-4 sm:min-h-[calc(100svh-3rem)] sm:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-white/10 bg-[#0f1115]/70 px-4 py-2.5 backdrop-blur-lg sm:px-5 sm:py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#94a3b8] sm:text-xs">Bitcoin DeFi Stack</p>
          <Link
            to="/login"
            className="rounded-full border border-[#f7931a]/60 bg-gradient-to-r from-[#ea580c] to-[#f7931a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a] sm:px-4 sm:text-[11px]"
          >
            Secure Access
          </Link>
        </header>

        <section className="grid overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0f1115]/65 sm:rounded-[2rem] lg:min-h-[calc(100svh-11rem)] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex items-center border-b border-white/10 p-5 sm:p-8 md:p-10 lg:border-b-0 lg:border-r">
            <div className="w-full max-w-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#94a3b8] sm:text-xs">Real-Time Decision Infrastructure</p>
              <h1 className="font-heading mt-3 text-3xl font-bold leading-tight text-white sm:mt-4 sm:text-4xl md:text-5xl lg:text-6xl">
                Real-Time Decision
                <span className="block text-gradient-btc">Support System</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#94a3b8] sm:mt-4 sm:text-base md:text-lg">
                Engineered for secure, data-driven operations with live analytics, intelligent forecasting, and premium-grade decision confidence.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
                <Link
                  to="/login"
                  className="glow-orange rounded-full bg-gradient-to-r from-[#ea580c] to-[#f7931a] px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-white transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a] sm:px-6 sm:py-3 sm:text-xs"
                >
                  Get Started
                </Link>
                <Link
                  to="/dashboard"
                  className="rounded-full border-2 border-white/20 px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-white transition hover:border-[#f7931a] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a] sm:px-6 sm:py-3 sm:text-xs"
                >
                  View Dashboard
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {featurePills.map((pill) => (
                  <div
                    key={pill}
                    className="holographic-gradient rounded-xl border border-white/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-[#f7931a]"
                  >
                    {pill}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative h-[42svh] min-h-[320px] max-h-[460px] overflow-hidden lg:h-auto lg:min-h-0 lg:max-h-none">
            <LandingPatternBackground />
            <div className="absolute inset-0 bg-gradient-to-r from-[#030304]/45 via-[#030304]/25 to-[#030304]/70" />

            <div className="absolute inset-0 p-4 sm:p-5 md:p-7">
              <div className="h-full rounded-2xl border border-[#f7931a]/40 bg-black/35 p-4 backdrop-blur-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ffd600]">Live Visual Node</p>
                <div className="relative mt-3 h-[55%] overflow-hidden rounded-xl border border-white/10 bg-black/35 sm:mt-4 sm:h-[60%]">
                  <video
                    src={redorbVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030304]/65 via-transparent to-transparent" />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                  <div className="rounded-xl border border-[#f7931a]/30 bg-[#f7931a]/10 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#ffd600]">Trust Layer</p>
                    <p className="mt-1 text-sm text-white">Secure Data Handling</p>
                  </div>
                  <div className="glow-gold rounded-xl border border-[#ffd600]/30 bg-[#ffd600]/10 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#f7931a]">Latency</p>
                    <p className="mt-1 text-sm text-white">Real-Time Insights</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {outputCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-2xl border border-white/10 bg-[#0f1115] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#f7931a]/50 hover:shadow-[0_0_30px_-10px_rgba(247,147,26,0.25)]"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Output</p>
              <h2 className="font-heading mt-2 text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{card.detail}</p>
            </article>
          ))}
        </section>

        <footer className="rounded-2xl border border-white/10 bg-[#0f1115]/80 px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="font-mono text-[10px] tracking-widest text-[#94a3b8] sm:text-xs">
            ENABLE DATA-DRIVEN DECISION MAKING • REDUCE OPERATIONAL RISK • IMPROVE PROFITABILITY
          </p>
        </footer>
      </div>
    </div>
  );
}
