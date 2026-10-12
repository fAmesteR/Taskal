import { motion } from "framer-motion";
import { Flame, Zap, Trophy, Clock } from "lucide-react";
import { UserStats } from "@/types/task";

interface StatsBarProps {
  stats: UserStats;
}

const CARDS = (stats: UserStats) => [
  {
    icon: Zap,
    label: "Points",
    value: stats.points.toLocaleString(),
    raw: stats.points,
    color: "text-accent",
    iconBg: "bg-accent/12 border-accent/20",
    edge: "panel-accent",
  },
  {
    icon: Flame,
    label: "Streak",
    value: `${stats.currentStreak}d`,
    raw: stats.currentStreak,
    color: "text-[hsl(var(--streak))]",
    iconBg: "bg-[hsl(28_96%_55%/0.12)] border-[hsl(28_96%_55%/0.22)]",
    edge: "panel-primary",
  },
  {
    icon: Trophy,
    label: "Done",
    value: String(stats.totalTasksCompleted),
    raw: stats.totalTasksCompleted,
    color: "text-primary",
    iconBg: "bg-primary/12 border-primary/20",
    edge: "panel-primary",
  },
  {
    icon: Clock,
    label: "Focus",
    value: stats.totalFocusMinutes >= 60
      ? `${(stats.totalFocusMinutes / 60).toFixed(1)}h`
      : `${stats.totalFocusMinutes}m`,
    raw: stats.totalFocusMinutes,
    color: "text-violet",
    iconBg: "bg-[hsl(262_78%_65%/0.12)] border-[hsl(262_78%_65%/0.22)]",
    edge: "panel-violet",
  },
];

export function StatsBar({ stats }: StatsBarProps) {
  const cards = CARDS(stats);

  return (
    <div className="grid grid-cols-4 gap-2">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.35, ease: "easeOut" }}
          className={`${card.edge} rounded-xl p-3 flex flex-col gap-1.5`}
        >
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center border ${card.iconBg}`}>
            <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
          </div>
          <p
            className={`font-mono font-bold text-xl leading-none tabular-nums ${card.color}`}
            style={{ animation: "count-in 0.4s ease-out both", animationDelay: `${0.1 + i * 0.07}s` }}
          >
            {card.value}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
            {card.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
