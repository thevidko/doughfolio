/** Pulsing placeholder shown while content is being fetched (owner request). */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`wobbly-2 animate-pulse bg-cream-dark/70 motion-reduce:animate-none ${className}`}
      aria-hidden
    />
  );
}
