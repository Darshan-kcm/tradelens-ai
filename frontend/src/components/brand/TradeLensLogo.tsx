interface LogoProps {
  className?: string;
  size?: number;
}

/** TradeLens AI mark: an optical lens framing three ascending candles. */
export function TradeLensLogo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
      data-testid="tradelens-logo"
    >
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#0B192C" />
      <circle cx="20" cy="19" r="12.5" stroke="#2563EB" strokeWidth="2" />
      <circle cx="20" cy="19" r="8" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
      <rect x="13.5" y="20" width="2.6" height="6" rx="1" fill="#38BDF8" />
      <rect x="18.7" y="16.5" width="2.6" height="9.5" rx="1" fill="#60A5FA" />
      <rect x="23.9" y="12.5" width="2.6" height="13.5" rx="1" fill="#22C55E" />
      <path d="M29 28.5 L34.5 34" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function TradeLensWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" data-testid="tradelens-wordmark">
      <TradeLensLogo size={compact ? 28 : 34} />
      {!compact && (
        <div className="leading-none">
          <div className="font-heading text-[17px] font-extrabold tracking-tight text-white">
            TradeLens<span className="text-[#38BDF8]"> AI</span>
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Market Research
          </div>
        </div>
      )}
    </div>
  );
}
