import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Trophy, User, Settings, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/",            icon: Home,       label: "Home"     },
  { path: "/leaderboard", icon: Trophy,     label: "Board"    },
  { path: "/profile",     icon: User,       label: "Profile"  },
  { path: "/settings",    icon: Settings,   label: "Settings" },
  { path: "/license",     icon: ScrollText, label: "About"    },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-md mx-auto px-4">
        <div
          className="pointer-events-auto rounded-2xl flex items-center justify-around h-[62px] px-2"
          style={{
            background: "hsl(226 26% 7% / 0.88)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid hsl(226 16% 18% / 0.8)",
            boxShadow:
              "0 8px 40px hsl(0 0% 0% / 0.55), 0 2px 8px hsl(0 0% 0% / 0.35), inset 0 1px 0 hsl(171 100% 47% / 0.08)",
          }}
        >
          {tabs.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-xl transition-colors duration-150",
                  "text-[10px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground/70",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-bg"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "hsl(171 100% 47% / 0.10)",
                      border: "1px solid hsl(171 100% 47% / 0.22)",
                      boxShadow: "inset 0 1px 0 hsl(171 100% 47% / 0.25), 0 0 12px hsl(171 100% 47% / 0.12)",
                    }}
                  />
                )}
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] relative z-10 transition-all duration-150",
                    active && "drop-shadow-[0_0_5px_hsl(171_100%_47%/0.7)]",
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
