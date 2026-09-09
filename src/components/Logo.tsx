export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="RepoPulse AI">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="img">
          <path d="M4 22h4l3-8 4 12 4-17 4 10h5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="19" r="2.5" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span>RepoPulse <b>AI</b></span>}
    </div>
  );
}
