import mascotUrl from "../assets/mascot.png";

/**
 * The dumpling mascot with its idle "breathing" bob (DESIGN.md phase 1).
 * Decorative by default; pass `alt` only when the image carries meaning.
 */
export function Mascot({ size = 96, still = false }: { size?: number; still?: boolean }) {
  return (
    <img
      src={mascotUrl}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`select-none rounded-full ${still ? "" : "animate-bob"}`}
      draggable={false}
    />
  );
}
