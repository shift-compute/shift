type LogoProps = {
  className?: string;
  /** Empty alt marks a repeated lockup as decorative. The header lockup keeps the name. */
  alt?: string;
};

/**
 * Official L5c5 lockup. The png is the committed jpg with its field removed,
 * so the mark sits on Paper.
 */
export function Logo({ className = "h-10 w-auto", alt = "Shift" }: LogoProps) {
  return <img src="/brand/l5c5-lockup.png" alt={alt} width={1107} height={278} className={className} />;
}
