import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Clock, ShieldCheck, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarBadge } from "@/components/AvatarBadge";
import { loadAvatar } from "@/lib/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)}h`;
}

type LeagueTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
const TIERS: LeagueTier[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

const TIER_META: Record<LeagueTier, {
  chip: string;
  activeBg: string;
  text: string;
  glow: string;
  emoji: string;
}> = {
  Bronze:   { chip: "border-orange-700/40 text-orange-400",   activeBg: "bg-orange-700/20 border-orange-700/60",   text: "text-orange-400",  glow: "0 0 16px hsl(22 70% 45% / 0.45)",   emoji: "🥉" },
  Silver:   { chip: "border-slate-400/40 text-slate-300",     activeBg: "bg-slate-400/15 border-slate-400/60",     text: "text-slate-300",   glow: "0 0 16px hsl(220 15% 65% / 0.4)",   emoji: "🥈" },
  Gold:     { chip: "border-yellow-500/40 text-yellow-400",   activeBg: "bg-yellow-500/15 border-yellow-500/60",   text: "text-yellow-400",  glow: "0 0 16px hsl(45 100% 55% / 0.45)",  emoji: "🥇" },
  Platinum: { chip: "border-cyan-400/40 text-cyan-300",       activeBg: "bg-cyan-400/12 border-cyan-400/60",       text: "text-cyan-300",    glow: "0 0 16px hsl(185 80% 65% / 0.4)",   emoji: "💠" },
  Diamond:  { chip: "border-violet-400/40 text-violet-300",   activeBg: "bg-violet-400/12 border-violet-400/60",   text: "text-violet-300",  glow: "0 0 16px hsl(265 75% 65% / 0.4)",   emoji: "💎" },
};

interface Entry {
  uid: string;
  username: string;
  avatarUrl: string | null;
  weeklyScore: number;
  weeklyFocusMinutes: number;
  rank: number;
}

function isoWeekIdUTC(d = new Date()): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

function timeUntilWeekEnd(): string {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + (8 - day),
  );
  const ms = Math.max(0, end - now.getTime());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function fetchMyTier(uid: string): Promise<LeagueTier> {
  const snap = await getDoc(doc(db, "users", uid));
  const tier = snap.data()?.leagueTier as LeagueTier | undefined;
  return tier && TIERS.includes(tier) ? tier : "Bronze";
}

function useLiveEntries(weekId: string, tier: LeagueTier) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [isError, setIsError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setEntries(null);
    setIsError(false);
    const q = query(
      collection(db, "weeklyScores", weekId, "leagues", tier, "entries"),
      orderBy("weeklyScore", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d, i) => {
            const data = d.data();
            return {
              uid: d.id,
              username: String(data.username ?? "anonymous"),
              avatarUrl: (data.avatarUrl as string | null) ?? null,
              weeklyScore: Number(data.weeklyScore ?? 0),
              weeklyFocusMinutes: Number(data.weeklyFocusMinutes ?? 0),
              rank: i + 1,
            };
          }),
        );
      },
      () => setIsError(true),
    );
    return unsub;
  }, [weekId, tier, nonce]);

  return {
    entries,
    isLoading: entries === null && !isError,
    isError,
    isLive: entries !== null && !isError,
    retry: () => setNonce((n) => n + 1),
  };
}

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHTS = ["h-24", "h-32", "h-20"];
const PODIUM_MEDALS = ["🥈", "🥇", "🥉"];
const PODIUM_MEDAL_REAL = ["🥇", "🥈", "🥉"];

function Podium({ entries, myUid }: { entries: Entry[]; myUid: string | null }) {
  const top3 = entries.slice(0, 3);
  return (
    <div className="flex items-end justify-center gap-2 pt-4 pb-2">
      {PODIUM_ORDER.filter((i) => i < top3.length).map((i, col) => {
        const e = top3[i];
        const isYou = e.uid === myUid;
        const isFirst = e.rank === 1;
        return (
          <motion.div
            key={e.uid}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: col * 0.1, type: "spring", stiffness: 140, damping: 18 }}
            className="flex flex-col items-center gap-1.5 w-[90px]"
          >
            {isFirst && (
              <Crown className="w-5 h-5 text-accent glow-text-accent -mb-0.5" />
            )}
            {isYou ? (
              <AvatarBadge
                config={loadAvatar()}
                className={cn(
                  "h-11 w-11 border-2",
                  isFirst ? "border-accent" : "border-primary/50",
                )}
                emojiClassName="text-xl"
              />
            ) : (
              <Avatar className={cn("h-11 w-11 border-2", isFirst ? "border-accent" : "border-border/60")}>
                {e.avatarUrl && <AvatarImage src={e.avatarUrl} />}
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                  {e.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <p className={cn("text-xs font-semibold truncate max-w-full text-center", isYou ? "text-primary" : "text-foreground")}>
              {isYou ? "You" : e.username}
            </p>

            {/* Podium block */}
            <div
              className={cn(
                "w-full rounded-t-xl flex flex-col items-center justify-start pt-2.5 relative overflow-hidden",
                PODIUM_HEIGHTS[PODIUM_ORDER.indexOf(i)],
              )}
              style={{
                background: isFirst
                  ? "linear-gradient(180deg, hsl(38 100% 58% / 0.22), hsl(38 100% 58% / 0.06))"
                  : "hsl(var(--surface-elevated))",
                border: `1px solid ${isFirst ? "hsl(38 100% 58% / 0.35)" : "hsl(var(--border) / 0.5)"}`,
                boxShadow: isFirst
                  ? "inset 0 1px 0 hsl(38 100% 58% / 0.4), 0 0 20px hsl(38 100% 58% / 0.14)"
                  : "inset 0 1px 0 hsl(var(--border) / 0.3)",
              }}
            >
              <span className="text-lg">{PODIUM_MEDAL_REAL[e.rank - 1]}</span>
              <span className="font-mono text-xs font-bold mt-1 tabular-nums">
                {e.weeklyScore.toLocaleString()}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {formatHours(e.weeklyFocusMinutes)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

const Leaderboard = () => {
  const myUid = auth.currentUser?.uid ?? null;
  const weekId = isoWeekIdUTC();
  const [countdown, setCountdown] = useState(timeUntilWeekEnd());

  useEffect(() => {
    const id = setInterval(() => setCountdown(timeUntilWeekEnd()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: myTier } = useQuery({
    queryKey: ["myTier", myUid],
    queryFn: () => fetchMyTier(myUid!),
    enabled: !!myUid,
  });

  const [selectedTier, setSelectedTier] = useState<LeagueTier | null>(null);
  const tier = selectedTier ?? myTier ?? "Bronze";

  const { entries, isLoading, isError, isLive, retry } = useLiveEntries(weekId, tier);

  const rows = entries ?? [];
  const rest = rows.slice(3);
  const myEntry = myUid ? rows.find((e) => e.uid === myUid) : undefined;
  const myAvatar = loadAvatar();
  const maxFocusMinutes = Math.max(1, ...rows.map((e) => e.weeklyFocusMinutes));

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
          boxShadow: "0 1px 0 hsl(38 100% 58% / 0.06)",
        }}
      >
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight leading-none">Leaderboard</h1>
              {isLive && (
                <span className="flex items-center gap-1 rounded-full border border-success/35 bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success tracking-widest uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Week {weekId.split("-W")[1]} · resets in {countdown}
            </p>
          </div>
          {myTier && (
            <Badge
              variant="outline"
              className={cn("font-bold text-xs", TIER_META[myTier].chip)}
            >
              {TIER_META[myTier].emoji} {myTier}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-5">

        {/* Tier selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
          {TIERS.map((t) => {
            const active = t === tier;
            const meta = TIER_META[t];
            return (
              <button
                key={t}
                onClick={() => setSelectedTier(t)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
                  active
                    ? cn(meta.activeBg, meta.text)
                    : cn("border-border/50 text-muted-foreground hover:text-foreground hover:border-border"),
                )}
                style={active ? { boxShadow: meta.glow } : undefined}
              >
                {meta.emoji} {t}
              </button>
            );
          })}
        </div>

        {/* States */}
        {isLoading ? (
          <div className="space-y-2 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 surface-elevated rounded-xl border border-border/40"
          >
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm font-semibold">Couldn't load standings</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              The server may be unreachable. Try again in a moment.
            </p>
            <button
              onClick={retry}
              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/18 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        ) : rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 surface-elevated rounded-xl border border-border/40"
          >
            <p className="text-3xl mb-3">{TIER_META[tier].emoji}</p>
            <p className="text-sm font-semibold">
              No one in {tier} League yet this week
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Complete a focus session to claim rank #1.
            </p>
          </motion.div>
        ) : (
          <>
            <Podium entries={rows} myUid={myUid} />

            <div className="space-y-2">
              {rest.map((e, i) => {
                const isYou = e.uid === myUid;
                return (
                  <motion.div
                    key={e.uid}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.25 + i * 0.025,
                      layout: { type: "spring", stiffness: 380, damping: 30 },
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      isYou
                        ? "panel-primary"
                        : "surface-elevated border-border/40",
                    )}
                  >
                    <span className="w-7 text-center font-mono font-bold text-sm text-muted-foreground tabular-nums">
                      #{e.rank}
                    </span>
                    {isYou ? (
                      <AvatarBadge config={myAvatar} className="h-9 w-9 shrink-0" emojiClassName="text-base" />
                    ) : (
                      <Avatar className="h-9 w-9 shrink-0">
                        {e.avatarUrl && <AvatarImage src={e.avatarUrl} />}
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                          {e.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold truncate", isYou ? "text-primary" : "text-foreground")}>
                        {isYou ? "You" : e.username}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="h-1.5 flex-1 max-w-[100px] rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(e.weeklyFocusMinutes / maxFocusMinutes) * 100}%` }}
                            transition={{ duration: 0.55, delay: 0.3 + i * 0.025 }}
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 tabular-nums">
                          {formatHours(e.weeklyFocusMinutes)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-foreground/80 shrink-0 tabular-nums">
                      {e.weeklyScore.toLocaleString()} <span className="text-muted-foreground font-normal">pts</span>
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {myUid && !myEntry && (
              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground py-2">
                <Flame className="w-3.5 h-3.5 text-streak" />
                You're unranked this week — finish a focus session to enter.
              </div>
            )}

            {/* Pinned rank chip */}
            {myEntry && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="fixed bottom-24 left-0 right-0 z-40 pointer-events-none"
              >
                <div className="max-w-xl mx-auto px-4">
                  <div
                    className="pointer-events-auto rounded-2xl px-4 py-2.5 flex items-center gap-3"
                    style={{
                      background: "hsl(226 26% 7% / 0.90)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid hsl(171 100% 47% / 0.30)",
                      boxShadow: "0 8px 32px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(171 100% 47% / 0.22)",
                    }}
                  >
                    <AvatarBadge config={myAvatar} className="h-8 w-8 shrink-0" emojiClassName="text-base" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-primary">Rank #{myEntry.rank}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatHours(myEntry.weeklyFocusMinutes)} focused this week
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {myEntry.weeklyScore.toLocaleString()}<span className="text-[10px] text-muted-foreground font-normal ml-0.5">pts</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground pt-1">
          <ShieldCheck className="w-3 h-3" />
          Integrity-weighted scores · tab-switching and idle time are detected
        </p>
      </main>
    </div>
  );
};

export default Leaderboard;
