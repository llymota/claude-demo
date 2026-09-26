export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="currentColor" />
        <path d="M4 14V9.5C4 6.5 6 4.5 9 4.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11.5" y="3" width="3" height="3" fill="currentColor" />
      </svg>
      Tendril
    </span>
  );
}
