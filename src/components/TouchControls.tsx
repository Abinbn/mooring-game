import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, HudData, TugAttachmentState } from "@/game/Game";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/utils/cn";

interface Props {
  onInput: (action: Action, down: boolean) => void;
  onToggleTugs?: () => void;
  onHorn?: () => void;
  hud: HudData;
}

/* ── Hold-to-act button ─────────────────────────────────────────── */
function TouchButton({
  action,
  onInput,
  className,
  icon,
  label,
  disabled,
  invert,
}: {
  action: Action;
  onInput: (a: Action, d: boolean) => void;
  className?: string;
  icon: IconName;
  label: string;
  disabled?: boolean;
  invert?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  // Latest handler in a ref: the unmount cleanup must not fire merely because
  // the parent re-created the callback (linked mode does that on every tick).
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

  // If the button disappears while held (pause, level clear, tug mode change)
  // release the command so the ship does not keep thrusting.
  useEffect(
    () => () => {
      if (!active.current) return;
      active.current = false;
      onInputRef.current(action, false);
    },
    [action],
  );

  return (
    <button
      ref={ref}
      type="button"
      className={cn("tbtn", disabled && "pointer-events-none opacity-40", className)}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      disabled={disabled}
    >
      <Icon name={icon} className={cn("h-6 w-6", invert && "rotate-90")} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] opacity-75">{label}</span>
    </button>
  );
}

/* ── Tap button ─────────────────────────────────────────────────── */
function TapButton({
  onClick,
  className,
  icon,
  label,
  pressed,
}: {
  onClick: () => void;
  className?: string;
  icon: IconName;
  label: string;
  pressed?: boolean;
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
      aria-pressed={pressed}
    >
      <Icon name={icon} className="h-5 w-5" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] opacity-75">{label}</span>
    </button>
  );
}

/* ── Speed read-out ─────────────────────────────────────────────── */
function SpeedBadge({ speed }: { speed: number }) {
  const kn = speed * 0.55;
  const stopped = Math.abs(kn) < 0.08;
  const reverse = kn < -0.08;
  return (
    <div
      className={cn(
        "num flex min-w-[68px] flex-col items-center justify-center rounded border px-2 py-1",
        stopped
          ? "border-danger/60 bg-danger/15 text-danger"
          : reverse
            ? "border-signal/60 bg-signal/15 text-signal"
            : "border-safe/60 bg-safe/15 text-safe",
      )}
      aria-label={`Speed ${kn.toFixed(1)} knots`}
    >
      <span className="text-[13px] font-bold leading-none">
        {stopped ? "0.0" : `${reverse ? "−" : ""}${Math.abs(kn).toFixed(1)}`}
      </span>
      <span className="text-[8px] font-semibold uppercase tracking-[0.1em] opacity-70">knots</span>
    </div>
  );
}

/* ── Pad ────────────────────────────────────────────────────────── */
export default function TouchControls({ onInput, onToggleTugs, onHorn, hud }: Props) {
  const [linked, setLinked] = useState(false);
  const tugState: TugAttachmentState = hud.tugState;
  const tugAttached = tugState === "attached";

  // Casting the tugs off must not leave the pad stuck in "linked" mode.
  useEffect(() => {
    if (!tugAttached) setLinked(false);
  }, [tugAttached]);

  const big = "short:h-[46px] short:w-[58px] h-[62px] w-[72px]";
  const engine = "short:h-[46px] short:w-[64px] h-[62px] w-[80px]";

  return (
    <div
      data-ui-pad
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 px-2 pb-[calc(10px_+_env(safe-area-inset-bottom))] font-display sm:px-3"
    >
      {/* ── Steering ─────────────────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-paper-mute short:hidden">
          {tugAttached ? (linked ? "Tugs · linked" : "Tugs") : "Rudder"}
        </span>

        {!tugAttached ? (
          <div className="flex gap-1.5">
            <TouchButton action="sternLeft" onInput={onInput} icon="chevronLeft" label="Port" className={big} />
            <TouchButton action="sternRight" onInput={onInput} icon="chevronRight" label="Stbd" className={big} />
          </div>
        ) : linked ? (
          <div className="flex gap-1.5">
            <TouchButton
              action="bowLeft"
              onInput={(_, d) => {
                onInput("bowLeft", d);
                onInput("sternLeft", d);
              }}
              icon="chevronLeft"
              label="Push"
              className={big}
            />
            <TouchButton
              action="bowRight"
              onInput={(_, d) => {
                onInput("bowRight", d);
                onInput("sternRight", d);
              }}
              icon="chevronRight"
              label="Pull"
              className={big}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <TouchButton action="bowLeft" onInput={onInput} icon="chevronLeft" label="Bow" className="short:h-[42px] short:w-[56px] h-[50px] w-[62px]" />
            <TouchButton action="bowRight" onInput={onInput} icon="chevronRight" label="Bow" className="short:h-[42px] short:w-[56px] h-[50px] w-[62px]" />
            <TouchButton action="sternLeft" onInput={onInput} icon="chevronLeft" label="Stern" className="short:h-[42px] short:w-[56px] h-[50px] w-[62px]" />
            <TouchButton action="sternRight" onInput={onInput} icon="chevronRight" label="Stern" className="short:h-[42px] short:w-[56px] h-[50px] w-[62px]" />
          </div>
        )}
      </div>

      {/* ── Tugs / link / horn ───────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1 self-end pb-0.5">
        <TapButton
          onClick={onToggleTugs ?? (() => {})}
          icon="anchor"
          label={tugAttached ? "Cast off" : "Summon"}
          pressed={tugAttached}
          className={cn(
            "short:h-[42px] short:w-[54px] h-[46px] w-[58px]",
            tugAttached
              ? "border-safe/70 bg-safe/20 text-safe"
              : hud.inRendezvousRange
                ? "border-signal/80 bg-signal/20 text-signal"
                : "text-paper-mute",
          )}
        />
        {tugAttached && (
          <TapButton
            onClick={() => setLinked((v) => !v)}
            icon="link"
            label={linked ? "Linked" : "Link"}
            pressed={linked}
            className={cn(
              "short:h-[38px] short:w-[54px] h-[40px] w-[58px]",
              linked ? "border-teal/70 bg-teal/20 text-teal" : "text-paper-mute",
            )}
          />
        )}
        <TapButton
          onClick={onHorn ?? (() => {})}
          icon="horn"
          label="Horn"
          className="short:h-[38px] short:w-[54px] h-[40px] w-[58px] text-paper-mute"
        />
      </div>

      {/* ── Engine ───────────────────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1 short:flex-row short:items-center">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-paper-mute short:hidden">Engine</span>
        <div className="flex flex-col items-center gap-1 short:flex-row">
          <TouchButton action="ahead" onInput={onInput} icon="chevronUp" label="Ahead" className={engine} />
          <SpeedBadge speed={hud.speed} />
          <TouchButton action="astern" onInput={onInput} icon="chevronDown" label="Astern" className={engine} />
        </div>
      </div>
    </div>
  );
}
