import { useCallback, useRef } from "react";
import type { Action } from "@/game/Game";
import { cn } from "@/utils/cn";

interface Props {
  onInput: (action: Action, down: boolean) => void;
}

function TouchButton({
  action,
  onInput,
  className,
  icon,
  label,
}: {
  action: Action;
  onInput: (a: Action, d: boolean) => void;
  className?: string;
  icon: string;
  label: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const active = useRef(false);

  const press = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
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
    [action, onInput],
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
      className={cn("tbtn", className)}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[9px] uppercase tracking-widest opacity-80">{label}</span>
    </button>
  );
}

export default function TouchControls({ onInput }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-3 font-display"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      {/* Tugs: top row = bow, bottom row = stern */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-cyan-200/80">Tugs</div>
        <div className="grid grid-cols-2 gap-2">
          <TouchButton action="bowLeft" onInput={onInput} icon="◀" label="Bow" className="h-[72px] w-[78px]" />
          <TouchButton action="bowRight" onInput={onInput} icon="▶" label="Bow" className="h-[72px] w-[78px]" />
          <TouchButton action="sternLeft" onInput={onInput} icon="◀" label="Stern" className="h-[72px] w-[78px]" />
          <TouchButton action="sternRight" onInput={onInput} icon="▶" label="Stern" className="h-[72px] w-[78px]" />
        </div>
      </div>

      {/* Engine */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-amber-200/80">Engine</div>
        <TouchButton action="ahead" onInput={onInput} icon="▲" label="Ahead" className="engine h-[72px] w-[92px]" />
        <TouchButton action="astern" onInput={onInput} icon="▼" label="Astern" className="engine h-[72px] w-[92px]" />
      </div>
    </div>
  );
}
