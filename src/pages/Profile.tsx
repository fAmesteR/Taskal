import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Flame,
  Clock,
  CheckCircle2,
  Star,
  Zap,
  Award,
  Pencil,
  Camera,
  Check,
  ChevronLeft,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "@/hooks/useTaskStore";
import {
  AvatarConfig,
  AVATAR_EMOJIS,
  AVATAR_GRADIENTS,
  fileToAvatarDataUrl,
  loadAvatar,
  saveAvatar,
} from "@/lib/avatar";
import { AvatarBadge } from "@/components/AvatarBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PROFILE_KEY = "focusplanner_profile";

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { displayName: "FocusUser" };
  } catch {
    return { displayName: "FocusUser" };
  }
}

const LEVEL_STEP = 100;
function getLevel(points: number) {
  return Math.floor(points / LEVEL_STEP) + 1;
}

interface StatsShape {
  points: number;
  longestStreak: number;
  totalTasksCompleted: number;
  totalFocusMinutes: number;
}

const ACHIEVEMENTS = [
  { icon: Flame,        label: "First Streak",  desc: "3-day streak",    threshold: (s: StatsShape) => s.longestStreak >= 3 },
  { icon: Zap,          label: "Power User",    desc: "10 tasks done",   threshold: (s: StatsShape) => s.totalTasksCompleted >= 10 },
  { icon: Clock,        label: "Time Lord",     desc: "60 min focused",  threshold: (s: StatsShape) => s.totalFocusMinutes >= 60 },
  { icon: Star,         label: "Century",       desc: "100 points",      threshold: (s: StatsShape) => s.points >= 100 },
  { icon: Award,        label: "Legendary",     desc: "500 points",      threshold: (s: StatsShape) => s.points >= 500 },
];

function AvatarEditor({
  avatar,
  onChange,
}: {
  avatar: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const image = await fileToAvatarDataUrl(file);
      onChange({ ...avatar, image });
      toast.success("Profile photo updated");
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <AvatarBadge
          config={avatar}
          className="h-20 w-20 border-2 border-primary/40 glow-primary"
          emojiClassName="text-4xl"
        />
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Camera className="w-3.5 h-3.5 mr-1.5" /> Upload photo
          </Button>
          {avatar.image && (
            <Button
              size="sm" variant="ghost"
              className="block text-xs text-muted-foreground"
              onClick={() => onChange({ ...avatar, image: null })}
            >
              Remove photo
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Pick a vibe</p>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onChange({ ...avatar, emoji: e, image: null })}
              className={cn(
                "h-9 rounded-lg text-lg transition-all hover:bg-secondary",
                avatar.emoji === e && !avatar.image
                  ? "bg-primary/15 ring-1 ring-primary/50"
                  : "",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Background</p>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_GRADIENTS.map((g, i) => (
            <button
              key={g}
              onClick={() => onChange({ ...avatar, gradient: i, image: null })}
              className={cn(
                "h-9 w-9 rounded-full transition-transform hover:scale-110 flex items-center justify-center",
                avatar.gradient === i && !avatar.image
                  ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
                  : "",
              )}
              style={{ background: g }}
            >
              {avatar.gradient === i && !avatar.image && (
                <Check className="w-4 h-4 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const Profile = () => {
  const { stats } = useTaskStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(loadProfile);
  const [avatar, setAvatar] = useState<AvatarConfig>(loadAvatar);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(profile.displayName);

  const level = getLevel(stats.points);
  const levelProgress = (stats.points % LEVEL_STEP) / LEVEL_STEP;
  const focusHours = (stats.totalFocusMinutes / 60).toFixed(1);
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.threshold(stats)).length;

  const updateAvatar = (a: AvatarConfig) => {
    setAvatar(a);
    saveAvatar(a);
  };

  const saveName = () => {
    const name = draft.trim();
    if (!name) return;
    const next = { ...profile, displayName: name };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setEditingName(false);
  };

  const statCards = [
    { icon: Star,         label: "Points",    value: stats.points.toLocaleString(),           color: "text-accent",    iconBg: "bg-accent/12 border-accent/20",           edge: "panel-accent" },
    { icon: Flame,        label: "Streak",    value: `${stats.currentStreak}d`,               color: "text-[hsl(var(--streak))]", iconBg: "bg-[hsl(28_96%_55%/0.12)] border-[hsl(28_96%_55%/0.22)]", edge: "panel-primary" },
    { icon: Flame,        label: "Best",      value: `${stats.longestStreak}d`,               color: "text-primary",   iconBg: "bg-primary/12 border-primary/20",         edge: "panel-primary" },
    { icon: Clock,        label: "Focus",     value: `${focusHours}h`,                        color: "text-violet",    iconBg: "bg-[hsl(262_78%_65%/0.12)] border-[hsl(262_78%_65%/0.22)]", edge: "panel-violet" },
    { icon: CheckCircle2, label: "Done",      value: String(stats.totalTasksCompleted),       color: "text-success",   iconBg: "bg-success/12 border-success/20",         edge: "panel-primary" },
    { icon: Zap,          label: "Level",     value: String(level),                           color: "text-accent",    iconBg: "bg-accent/12 border-accent/20",           edge: "panel-accent" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">

      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "hsl(226 32% 5% / 0.82)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid hsl(226 16% 14% / 0.7)",
        }}
      >
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-lg border border-border/50 bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight">Profile</h1>
          </div>
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-5">

        {/* Hero identity card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(135deg, hsl(226 26% 9%), hsl(262 28% 10%), hsl(226 26% 9%))",
            border: "1px solid hsl(226 16% 16% / 0.7)",
            boxShadow: "inset 0 1px 0 hsl(171 100% 47% / 0.20), 0 4px 28px hsl(0 0% 0% / 0.4)",
          }}
        >
          {/* Ambient blobs */}
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            <div className="absolute rounded-full"
              style={{ width: 200, height: 200, top: "-30%", right: "10%",
                background: "radial-gradient(circle, hsl(171 100% 47% / 0.18), transparent 70%)",
                filter: "blur(35px)" }} />
            <div className="absolute rounded-full"
              style={{ width: 160, height: 160, bottom: "-20%", left: "5%",
                background: "radial-gradient(circle, hsl(262 78% 65% / 0.14), transparent 70%)",
                filter: "blur(30px)" }} />
          </div>

          <div className="relative p-6 flex flex-col items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <button className="relative group" title="Customize avatar">
                  <AvatarBadge
                    config={avatar}
                    className="h-24 w-24 border-2 border-primary/35 glow-primary transition-transform group-hover:scale-105"
                    emojiClassName="text-5xl"
                  />
                  <span className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background shadow-md">
                    <Pencil className="w-3 h-3" />
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Customize avatar</DialogTitle>
                </DialogHeader>
                <AvatarEditor avatar={avatar} onChange={updateAvatar} />
              </DialogContent>
            </Dialog>

            {editingName ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-44 h-9 bg-secondary/60"
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                />
                <Button size="sm" onClick={saveName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            ) : (
              <button
                onClick={() => { setDraft(profile.displayName); setEditingName(true); }}
                className="group flex items-center gap-1.5 text-xl font-bold hover:text-primary transition-colors"
              >
                {profile.displayName}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </button>
            )}

            {/* Level XP bar */}
            <div className="w-full max-w-[260px]">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="font-bold text-accent">Level {level}</span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {stats.points % LEVEL_STEP}/{LEVEL_STEP} XP
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress * 100}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                    boxShadow: "0 0 10px hsl(var(--primary) / 0.4)",
                  }}
                />
              </div>
            </div>

            <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 border border-border/40 rounded-full px-3 py-1">
              {focusHours}h lifetime focus
            </span>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-3 gap-2"
        >
          {statCards.map((s, i) => (
            <div
              key={s.label}
              className={`${s.edge} rounded-xl p-3.5 flex flex-col gap-2`}
              style={{ animationDelay: `${i * 0.05}s`, animation: "count-in 0.4s ease-out both" }}
            >
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center border ${s.iconBg}`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className={`font-mono font-bold text-xl leading-none tabular-nums ${s.color}`}>
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">
              Achievements
            </h2>
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {unlockedCount}/{ACHIEVEMENTS.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = a.threshold(stats);
              return (
                <div
                  key={a.label}
                  className={cn(
                    "rounded-xl p-4 flex items-center gap-3 border transition-all",
                    unlocked
                      ? "panel-accent"
                      : "surface-elevated border-border/30 opacity-45",
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                      unlocked
                        ? "bg-accent/12 border-accent/25"
                        : "bg-secondary border-border/40",
                    )}
                  >
                    {unlocked
                      ? <a.icon className="w-5 h-5 text-accent" />
                      : <Lock className="w-4 h-4 text-muted-foreground/50" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{a.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Profile;
