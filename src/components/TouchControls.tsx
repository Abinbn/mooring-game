import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, HudData, TugAttachmentState } from "@/game/Game";
import { cn } from "@/utils/cn";

interface Props {
  onInput: (action: Action, down: boolean) => void;
  onToggleTugs?: () => void;
  onHorn?: () => void;
  hud: HudData;
}

// ─── Generic touch button ───────────────────────────────────────────────────
function TouchButton({
  action,
  onInput,
  className,
  icon,
  label,
  disabled,
}: {
  action: Action;
  onInput: (a: Action, d: boolean) => void;
  className?: string;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  // Keep the latest handler in a ref: the unmount cleanup below must not fire
  // just because the parent re-created the callback (linked mode does that on
  // every HUD tick, which would release a held button immediately).
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const press = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.preventDefault();
      if (active.current) return;
      active.current = true;
      try {
        ref.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      ref.current?.classList.add("pressed");
      onInput(action, true);
    },
    [action, onInput, disabled],
  );

  // If the button disappears while held (pause, level clear, tug mode change)
  // release the action so the ship does not keep its engine/tug command.
  useEffect(
    () => () => {
      if (!active.current) return;
      active.current = false;
      onInputRef.current(action, false);
    },
    [action],
  );

  const release = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!active.current) return;
      active.current = false;
      ref.current?.classList.remove("pressed");
      onInput(action, false);
    },
    [action, onInput],
  );

  return (
    <button
      ref={ref}
      type="button"
      className={cn("tbtn", disabled && "opacity-30 pointer-events-none", className)}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      disabled={disabled}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[9px] uppercase tracking-widest opacity-80">{label}</span>
    </button>
  );
}

// ─── Tap-only (non-hold) action button ─────────────────────────────────────
function TapButton({
  onClick,
  className,
  icon,
  label,
}: {
  onClick: () => void;
  className?: string;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn("tbtn", className)}
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[9px] uppercase tracking-widest opacity-80">{label}</span>
    </button>
  );
}

// ─── Speed indicator ────────────────────────────────────────────────────────
function SpeedBadge({ speed }: { speed: number }) {
  const kn = speed * 0.55;
  const stopped = Math.abs(kn) < 0.08;
  const reverse = kn < -0.08;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums tracking-wider ring-1 min-w-[64px]",
        stopped
          ? "bg-red-700/70 text-red-100 ring-red-400/60"
          : reverse
            ? "bg-red-500/30 text-red-200 ring-red-400/60"
            : "bg-emerald-500/25 text-emerald-200 ring-emerald-400/60",
      )}
    >
      {stopped ? "STOP" : `${reverse ? "" : "+"}${kn.toFixed(1)} kn`}
    </div>
  );
}

// ─── Main touch controls ────────────────────────────────────────────────────
export default function TouchControls({ onInput, onToggleTugs, onHorn, hud }: Props) {
  const [linked, setLinked] = useState(false);
  const tugState: TugAttachmentState = hud.tugState;
  const tugAttached = tugState === "attached";

  // Casting the tugs off must not leave the pad stuck in "linked" mode.
  useEffect(() => {
    if (!tugAttached) setLinked(false);
  }, [tugAttached]);

  // Without tugs: rudder-only steering (sternLeft/Right = rudder)
  // With tugs: 4-button tug control OR linked push/pull
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-2 pb-3 font-display sm:px-3"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      {/* ── Left: steering group ───────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col gap-2">
        {!tugAttached ? (
          /* Solo mode: rudder left / right */
          <>
            <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-cyan-200/80">
              Rudder
            </div>
            <div className="flex gap-2">
              <TouchButton
                action="sternLeft"
                onInput={onInput}
                icon="◀"
                label="Port"
                className="h-[68px] w-[70px] sm:h-[72px] sm:w-[78px]"
              />
              <TouchButton
                action="sternRight"
                onInput={onInput}
                icon="▶"
                label="Stbd"
                className="h-[68px] w-[70px] sm:h-[72px] sm:w-[78px]"
              />
            </div>
          </>
        ) : linked ? (
          /* Linked tug mode: single PUSH / PULL */
          <>
            <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-cyan-200/80">
              Tugs — Linked
            </div>
            <div className="flex gap-2">
              <TouchButton
                action="bowLeft"
                onInput={(_, d) => {
                  onInput("bowLeft", d);
                  onInput("sternLeft", d);
                }}
                icon="⬅"
                label="Push"
                className="h-[68px] w-[70px] sm:h-[72px] sm:w-[78px]"
              />
              <TouchButton
                action="bowRight"
                onInput={(_, d) => {
                  onInput("bowRight", d);
                  onInput("sternRight", d);
                }}
                icon="➡"
                label="Pull"
                className="h-[68px] w-[70px] sm:h-[72px] sm:w-[78px]"
              />
            </div>
          </>
        ) : (
          /* Tug mode: 4 individual buttons */
          <>
            <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-cyan-200/80">
              Tugs
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TouchButton action="bowLeft" onInput={onInput} icon="◀" label="Bow" className="h-[56px] w-[64px] sm:h-[60px] sm:w-[68px]" />
              <TouchButton action="bowRight" onInput={onInput} icon="▶" label="Bow" className="h-[56px] w-[64px] sm:h-[60px] sm:w-[68px]" />
              <TouchButton action="sternLeft" onInput={onInput} icon="◀" label="Stern" className="h-[56px] w-[64px] sm:h-[60px] sm:w-[68px]" />
              <TouchButton action="sternRight" onInput={onInput} icon="▶" label="Stern" className="h-[56px] w-[64px] sm:h-[60px] sm:w-[68px]" />
            </div>
          </>
        )}
      </div>

      {/* ── Centre: ⚓ tug toggle + 🔗 link (if tug) + 📯 horn ── */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 self-end pb-1">
        {/* Tug toggle button */}
        <TapButton
          onClick={onToggleTugs ?? (() => {})}
          icon="⚓"
          label={tugAttached ? "Cast Off" : "Summon"}
          className={cn(
            "h-[52px] w-[56px] text-xl",
            tugAttached
              ? "bg-cyan-500/25 ring-2 ring-cyan-300 shadow-[0_0_10px_rgba(56,225,255,0.45)] text-cyan-100"
              : hud.inRendezvousRange
                ? "ring-2 ring-amber-400 bg-amber-400/20 text-amber-300 anim-blink"
                : "text-cyan-200/60",
          )}
        />
        {/* Link toggle — only when tugs are attached */}
        {tugAttached && (
          <button
            type="button"
            className={cn(
              "tbtn h-[38px] w-[56px] text-sm",
              linked
                ? "bg-purple-500/30 ring-2 ring-purple-300 text-purple-200"
                : "text-cyan-200/60",
            )}
            onPointerDown={(e) => {
              e.preventDefault();
              setLinked((v) => !v);
            }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Link tugs"
            aria-pressed={linked}
          >
            <span className="text-base leading-none">{linked ? "🔗" : "🔓"}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-80">
              {linked ? "Linked" : "Link"}
            </span>
          </button>
        )}
        {/* Horn button */}
        <TapButton
          onClick={onHorn ?? (() => {})}
          icon="📯"
          label="Horn"
          className="h-[44px] w-[56px] text-xl text-amber-200/70"
        />
      </div>

      {/* ── Right: engine group ───────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-amber-200/80">
          Engine
        </div>
        <TouchButton action="ahead" onInput={onInput} icon="▲" label="Ahead" className="engine h-[68px] w-[80px] sm:h-[72px] sm:w-[88px]" />
        <SpeedBadge speed={hud.speed} />
        <TouchButton action="astern" onInput={onInput} icon="▼" label="Astern" className="engine h-[68px] w-[80px] sm:h-[72px] sm:w-[88px]" />
      </div>
    </div>
  );
}
