import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Target, Trophy, ShieldCheck, Flame, Zap } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEATURES = [
  {
    icon: Trophy,
    title: "Compete globally",
    desc: "Live leaderboards reset every week — your rank is earned fresh.",
    color: "text-accent",
    bg: "bg-accent/10 border-accent/20",
  },
  {
    icon: ShieldCheck,
    title: "Integrity tracking",
    desc: "Tab-switching and idle time are detected. Only real focus scores.",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    icon: Flame,
    title: "Streak & leagues",
    desc: "Build daily streaks. Climb Bronze → Diamond through the tiers.",
    color: "text-streak",
    bg: "bg-[hsl(28_96%_55%/0.10)] border-[hsl(28_96%_55%/0.20)]",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(
        msg.includes("auth/")
          ? msg.replace(/^Firebase: Error \(auth\/(.+)\)\.?$/, "$1").replace(/-/g, " ")
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background overflow-hidden">

      {/* ── Left hero panel ── */}
      <div className="relative lg:flex-1 flex flex-col items-center justify-center p-8 py-14 lg:py-0 overflow-hidden">

        {/* Animated ambient blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute rounded-full opacity-60"
            style={{
              width: 340, height: 340,
              top: "5%", left: "-8%",
              background: "radial-gradient(circle, hsl(171 100% 47% / 0.22), transparent 70%)",
              filter: "blur(50px)",
              animation: "blob-drift 10s ease-in-out infinite",
            }}
          />
          <div
            className="absolute rounded-full opacity-50"
            style={{
              width: 280, height: 280,
              bottom: "8%", right: "2%",
              background: "radial-gradient(circle, hsl(262 78% 65% / 0.18), transparent 70%)",
              filter: "blur(45px)",
              animation: "blob-drift 13s ease-in-out infinite reverse",
            }}
          />
          <div
            className="absolute rounded-full opacity-40"
            style={{
              width: 200, height: 200,
              top: "50%", right: "15%",
              background: "radial-gradient(circle, hsl(38 100% 58% / 0.12), transparent 70%)",
              filter: "blur(35px)",
              animation: "blob-drift 8s ease-in-out infinite",
              animationDelay: "3s",
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative z-10 max-w-sm w-full"
        >
          {/* Logo lockup */}
          <div className="flex items-center gap-4 mb-10">
            <div className="h-14 w-14 rounded-2xl bg-primary/12 flex items-center justify-center glow-primary border border-primary/25 shrink-0">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient leading-none">
                Taskal
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Schedule · Focus · Level up
              </p>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                className={`flex items-start gap-3 p-3.5 rounded-xl border ${bg}`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color} bg-current/10`}
                  style={{ background: "transparent" }}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Social proof hint */}
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>Join the leaderboard — your first session earns points.</span>
          </div>
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="lg:w-[420px] flex flex-col items-center justify-center p-8 lg:border-l lg:border-border/40 lg:bg-card/25 lg:backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Mode toggle */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(null); }}
                    className="text-primary font-medium hover:underline underline-offset-2"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(null); }}
                    className="text-primary font-medium hover:underline underline-offset-2"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/60 border-border/70 h-11 text-sm focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/60 border-border/70 h-11 text-sm focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 capitalize"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-sm glow-primary mt-1"
              disabled={loading || !email || !password}
            >
              {loading
                ? "..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed">
            By continuing you agree to our terms. Sessions are integrity-tracked
            and scores are validated server-side.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
