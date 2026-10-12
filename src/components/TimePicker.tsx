import * as React from "react";
import { Clock, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Current time rounded up to the next step (so the default is always "now") */
function nowRounded(step: number): { h: number; m: number } {
  const d = new Date();
  let h = d.getHours();
  let m = Math.ceil(d.getMinutes() / step) * step;
  if (m >= 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return { h, m };
}

function Wheel({
  items,
  selected,
  onSelect,
  format,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  format: (v: number) => string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Center the selected value whenever it changes / on open
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(
      "[data-selected=true]",
    );
    el?.scrollIntoView({ block: "center" });
  }, [selected]);

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        className="h-44 overflow-y-auto scrollbar-none snap-y px-1 py-[72px]"
      >
        {items.map((v) => {
          const isSel = v === selected;
          return (
            <button
              key={v}
              type="button"
              data-selected={isSel}
              onClick={() => onSelect(v)}
              className={cn(
                "w-full snap-center rounded-lg py-1.5 font-mono text-sm transition-all",
                isSel
                  ? "bg-primary text-primary-foreground font-bold scale-105 glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
      {/* fade edges for the wheel illusion */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-popover to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-popover to-transparent" />
    </div>
  );
}

type TimeValue = string; // "HH:mm"

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  minuteStep = 5,
  disabled = false,
}: {
  value: TimeValue | "";
  onChange: (v: TimeValue) => void;
  placeholder?: string;
  minuteStep?: 1 | 5 | 10 | 15;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = React.useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) out.push(m);
    return out;
  }, [minuteStep]);

  // The wheels always point at the current time until a value is chosen
  const sel = value
    ? { h: Number(value.slice(0, 2)), m: Number(value.slice(3, 5)) }
    : nowRounded(minuteStep);

  const commit = (h: number, m: number) => onChange(`${pad2(h)}:${pad2(m)}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-between bg-secondary border border-border"
          disabled={disabled}
        >
          <span className={value ? "font-mono" : "text-muted-foreground"}>
            {value || placeholder}
          </span>
          <Clock className="h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-0 overflow-hidden" align="start">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-primary">
            {pad2(sel.h)}:{pad2(sel.m)}
          </span>
          <button
            type="button"
            onClick={() => {
              const { h, m } = nowRounded(minuteStep);
              commit(h, m);
            }}
            className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <LocateFixed className="w-3 h-3" /> Now
          </button>
        </div>

        <div className="flex gap-1 px-2">
          <Wheel
            items={hours}
            selected={sel.h}
            onSelect={(h) => commit(h, sel.m)}
            format={pad2}
          />
          <div className="flex items-center font-mono text-muted-foreground">
            :
          </div>
          <Wheel
            items={minutes}
            selected={sel.m}
            onSelect={(m) => commit(sel.h, m)}
            format={pad2}
          />
        </div>

        <div className="p-2 border-t border-border">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => {
              // Confirm whatever the wheels point at (defaults to now)
              commit(sel.h, sel.m);
              setOpen(false);
            }}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
