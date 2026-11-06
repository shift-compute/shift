/**
 * Full-bleed field behind the home page: a drifting dot grid and two
 * CardArt washes (Sky, Teal). No WebGL. Loops are CSS and stop when
 * the visitor prefers reduced motion.
 */
export function AmbientField() {
  return (
    <div className="landing-ambient" aria-hidden="true">
      <div className="landing-orb landing-orb-sky" />
      <div className="landing-orb landing-orb-teal" />
      <div className="landing-orb landing-orb-low" />
      <div className="landing-grid" />
    </div>
  );
}
