import backgroundVideo from '../assets/PixVerse_V6_Extend_360P_meke_a_little_bit_more.mp4';

export default function AppVideoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <video
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-slate-950/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 via-slate-950/35 to-slate-950/70" />
    </div>
  );
}
