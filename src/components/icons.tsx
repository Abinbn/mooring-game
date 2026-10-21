import type { SVGProps } from "react";
import { cn } from "@/utils/cn";

/**
 * A small, hand-drawn icon set. Everything in the UI uses these instead of
 * emoji so the glyphs look the same on iOS, Android, Windows and Linux, and
 * so they inherit the interface colour.
 */
const PATHS = {
  anchor: (
    <>
      <circle cx="12" cy="4.6" r="2.1" />
      <path d="M12 6.7V20" />
      <path d="M7.4 10.4h9.2" />
      <path d="M4.6 14.2a7.4 7.4 0 0 0 14.8 0" />
      <path d="M4.6 14.2H3m1.6 0h1.6m13.2 0H21m-1.6 0h-1.6" />
    </>
  ),
  horn: (
    <>
      <path d="M4 10.6v2.8a1.6 1.6 0 0 0 1.6 1.6h1.9L14 19V5L7.5 9H5.6A1.6 1.6 0 0 0 4 10.6Z" />
      <path d="M17.4 9.2a4 4 0 0 1 0 5.6" />
      <path d="M19.7 6.8a7.4 7.4 0 0 1 0 10.4" />
    </>
  ),
  link: (
    <>
      <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l2.4-2.4a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2" />
      <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-2.4 2.4a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h3l4 3.4V6.6L7 10H4Z" />
      <path d="M15 9.4a3.6 3.6 0 0 1 0 5.2" />
      <path d="M17.6 7a7 7 0 0 1 0 10" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M4 10v4h3l4 3.4V6.6L7 10H4Z" />
      <path d="m15.4 9.6 4.2 4.8M19.6 9.6l-4.2 4.8" />
    </>
  ),
  pause: (
    <>
      <path d="M9.2 6v12M14.8 6v12" />
    </>
  ),
  play: <path d="M8.5 5.6 18 12l-9.5 6.4V5.6Z" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  chevronUp: <path d="m6 14 6-6 6 6" />,
  chevronDown: <path d="m6 10 6 6 6-6" />,
  alert: (
    <>
      <path d="M12 4.8 21 19.5H3L12 4.8Z" />
      <path d="M12 10v4.1" />
      <path d="M12 17.1h.01" />
    </>
  ),
  star: <path d="m12 4.4 2.3 4.9 5.3.7-3.9 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2L4.4 10l5.3-.7L12 4.4Z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11v5.2" />
      <path d="M12 7.9h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 4.4 19 7v5c0 4.1-2.9 6.7-7 8-4.1-1.3-7-3.9-7-8V7l7-2.6Z" />
      <path d="m9.2 12.1 2 2 3.6-3.8" />
    </>
  ),
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  check: <path d="m5.5 12.5 4 4 9-9" />,
  rudder: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6v16.8M3.6 12h16.8" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const filled = name === "play" || name === "star";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5", className)}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
