// Surfaces and pills from the Graphi portal language: glass with a faint orange/blue corner glow, hairline
// borders, a 1px top highlight. Pill sizes are separate constants: never add an h-* on top of one.
import type { CSSProperties, ReactNode } from "react";

export const CARD_GLOW =
  "bg-[radial-gradient(100%_90%_at_0%_100%,rgba(218,78,36,0.15),transparent_62%),radial-gradient(100%_90%_at_100%_0%,rgba(31,119,246,0.15),transparent_62%)]";

export const SURFACE = `border border-white/[0.08] bg-white/[0.025] ${CARD_GLOW} backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-32px_rgba(0,0,0,0.9)]`;

/** Inner box for one item inside a card. */
export const INNER_BOX = "rounded-[16px] border border-white/[0.08] bg-white/[0.03]";

/** Card fill for nodes on the pipeline and agent cards. */
export const NODE_FILL = `bg-node ${CARD_GLOW} shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_-24px_rgba(0,0,0,0.95)]`;

const PILL_BASE =
  "inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-white/75 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] whitespace-nowrap";
const PRESSABLE =
  "cursor-pointer transition-[background-color,border-color,color,transform] duration-150 hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

export const PILL = `${PILL_BASE} h-9 px-3.5 text-[13px]`;
export const PILL_BUTTON = `${PILL} ${PRESSABLE}`;
export const PILL_ICON_BUTTON = `${PILL_BASE} ${PRESSABLE} size-9 justify-center`;
export const PILL_SM = `${PILL_BASE} h-7 gap-1.5 px-3 text-[12px]`;
export const PILL_SM_BUTTON = `${PILL_SM} ${PRESSABLE}`;
export const TAG = `${PILL_BASE} h-6 gap-1.5 px-2.5 text-[11px]`;

/** Primary action: solid white pill (Graphi's "Decide" / PillLink). */
export const PRIMARY =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium whitespace-nowrap text-black transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
export const PRIMARY_SM =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium whitespace-nowrap text-black transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
export const DANGER_SM =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-st-danger/35 bg-st-danger/10 px-3 text-[12px] font-medium whitespace-nowrap text-[#ff9a92] transition-colors duration-150 hover:bg-st-danger/20 disabled:pointer-events-none disabled:opacity-40";

/** The landing page's moving border: a single orange streak orbiting a hairline frame. */
export const LASER_CONIC = "conic-gradient(from 0deg at 50% 50%, #0000 320.4deg, #da4e24 334.8deg, #0000 349.2deg)";
export const LASER_CONIC_BLUE = "conic-gradient(from 0deg at 50% 50%, #0000 320.4deg, #1f77f6 334.8deg, #0000 349.2deg)";
export const LASER_CONIC_AMBER = "conic-gradient(from 0deg at 50% 50%, #0000 300deg, #ff7a2f 330deg, #0000 355deg)";

const RING_MASK: CSSProperties = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
};

/** The orbiting laser is masked to the 1px outline, so the inside stays glass. */
export function LaserBorder({
  children,
  radius = 16,
  active = true,
  conic = LASER_CONIC,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  radius?: number;
  active?: boolean;
  conic?: string;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`relative p-px ${className}`} style={{ borderRadius: radius }}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden p-px" style={{ borderRadius: radius, ...RING_MASK }}>
        <span className="absolute inset-0 bg-white/12" />
        {active && (
          <span className="absolute top-1/2 left-1/2 aspect-square w-[160%] min-w-[260px] -translate-x-1/2 -translate-y-1/2">
            <span className="portal-spin block size-full" style={{ background: conic }} />
          </span>
        )}
      </span>
      <div className={`relative h-full ${innerClassName}`} style={{ borderRadius: radius - 1 }}>
        {children}
      </div>
    </div>
  );
}

/** The Hukam mark: Graphi's orb (blue core, orange rim light). */
export function LogoOrb({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 30% 28%, #9fd4ff 0%, #1f77f6 22%, #0a1a3a 55%, #000 72%), radial-gradient(circle at 75% 80%, #ff7a2f 0%, transparent 45%)",
        backgroundBlendMode: "screen",
        boxShadow: "inset -3px -4px 8px rgba(255,120,40,.55), inset 2px 3px 6px rgba(160,210,255,.35)",
      }}
    />
  );
}
