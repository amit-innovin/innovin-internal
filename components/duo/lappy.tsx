import { LAPPY_POSES, type LappyPose } from "./lappy-poses";

// Lappy, the laptop mascot. One character, six poses; the drawings come straight from the
// design canvas (see lappy-poses.ts). Animations stop under prefers-reduced-motion (app/duo.css).
export function Lappy({ pose = "idle", width = 136, decorative = false }: { pose?: LappyPose; width?: number; decorative?: boolean }) {
  const p = LAPPY_POSES[pose];
  return (
    <svg
      width={width}
      height={Math.round((width * p.height) / p.width)}
      viewBox={p.viewBox}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": p.label })}
      // Static markup generated from our own design files, never user input.
      dangerouslySetInnerHTML={{ __html: p.svg }}
    />
  );
}
