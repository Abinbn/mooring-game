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

/**
 * One size for every control on the pad. Keeping them identical is what makes
 * the cluster read as an instrument panel rather than a pile of buttons.
 */
const BTN = "h-[54px] w-[54px] short:h-[44px] short:w-[44px]";
const LABEL = "text-[9px] font-semibold uppercase tracking-[0.08em] opacity-75";

/* ── Hold-to-act button ─────────────────────────────────────────── */
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
  icon: IconName;
  label: string;
  disabled?: boolean;
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
      className={cn("tbtn", BTN, disabled && "pointer-events-none opacity-40", className)}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      disabled={disabled}
    >
      <Icon name={icon} className="h-[22px] w-[22px] short:h-5 short:w-5" />
      <span className={LABEL}>{label}</span>
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
      className={cn("tbtn", BTN, className)}
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      aria-pressed={pressed}
    >
      <Icon name={icon} className="h-[22px] w-[22px] short:h-5 short:w-5" />
      <span className={LABEL}>{label}</span>
    </button>
  );
}

/* ── Speed read-out ─────────────────────────────────────────────── */
function SpeedBadge({ speed }: { speed: number }) {
  const kn = speed * 0.55;
  const stopped = Math.abs(kn) < 0.05;
  const reverse = kn < -0.05;
  return (
    <div
      className={cn(
        "num flex w-[54px] flex-col items-center justify-center rounded border py-1 short:w-[44px]",
        stopped
          ? "border-paper/20 bg-paper/[0.06] text-paper-mute"
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

  const linkButton = (
    <TapButton
      onClick={() => setLinked((v) => !v)}
      icon="link"
      label={linked ? "Linked" : "Link"}
      pressed={linked}
      className={cn(linked ? "border-teal/70 bg-teal/20 text-teal" : "text-paper-mute")}
    />
  );

  return (
    <div
      data-ui-pad
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 px-2 pb-[calc(10px_+_env(safe-area-inset-bottom))] font-display sm:px-3"
    >
      {/* ── Steering (bow + stern tugs, or the rudder) ────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-paper-mute short:hidden">
          {tugAttached ? (linked ? "Tugs · linked" : "Tugs") : "Rudder"}
        </span>

        {!tugAttached ? (
          <div className="flex gap-1.5">
            <TouchButton action="sternLeft" onInput={onInput} icon="chevronLeft" label="Port" />
            <TouchButton action="sternRight" onInput={onInput} icon="chevronRight" label="Stbd" />
          </div>
        ) : linked ? (
          /* Linked: the mode switch sits between Push and Pull */
          <div className="flex gap-1.5">
            <TouchButton
              action="bowLeft"
              onInput={(_, d) => {
                onInput("bowLeft", d);
                onInput("sternLeft", d);
              }}
              icon="chevronLeft"
              label="Push"
            />
            {linkButton}
            <TouchButton
              action="bowRight"
              onInput={(_, d) => {
                onInput("bowRight", d);
                onInput("sternRight", d);
              }}
              icon="chevronRight"
              label="Pull"
            />
          </div>
        ) : (
          /* Independent tugs: the mode switch sits in the middle of the four */
          <div className="grid grid-cols-3 gap-1.5">
            <TouchButton action="bowLeft" onInput={onInput} icon="chevronLeft" label="Bow" />
            <div className="row-span-2 flex items-center">{linkButton}</div>
            <TouchButton action="bowRight" onInput={onInput} icon="chevronRight" label="Bow" />
            <TouchButton action="sternLeft" onInput={onInput} icon="chevronLeft" label="Stern" />
            <TouchButton action="sternRight" onInput={onInput} icon="chevronRight" label="Stern" />
          </div>
        )}
      </div>

      {/* ── Tug telegraph + horn ─────────────────────────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 self-end">
        <TapButton
          onClick={onToggleTugs ?? (() => {})}
          icon="anchor"
          label={tugAttached ? "Cast off" : "Summon"}
          pressed={tugAttached}
          className={cn(
            tugAttached
              ? "border-safe/70 bg-safe/20 text-safe"
              : hud.inRendezvousRange
                ? "border-signal/80 bg-signal/20 text-signal"
                : "text-paper-mute",
          )}
        />
        <TapButton onClick={onHorn ?? (() => {})} icon="horn" label="Horn" className="text-paper-mute" />
      </div>

      {/* ── Engine, with the speed read-out above it ─────────── */}
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 self-end">
        <SpeedBadge speed={hud.speed} />
        <TouchButton action="ahead" onInput={onInput} icon="chevronUp" label="Ahead" />
        <TouchButton action="astern" onInput={onInput} icon="chevronDown" label="Astern" />
      </div>
    </div>
  );
}
