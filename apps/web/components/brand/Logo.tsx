type LogoProps = {
  className?: string;
  /** Empty alt marks a repeated lockup as decorative. The header lockup keeps the name. */
  alt?: string;
};

/**
 * Official L5s6 lockup. The png is the committed jpg with its field removed,
 * so the mark sits on Sky instead of a darker rectangle.
 */
export function Logo({ className = "h-10 w-auto", alt = "Shift" }: LogoProps) {
  return <img src="/brand/l5s6-lockup.png" alt={alt} width={903} height={337} className={className} />;
}
