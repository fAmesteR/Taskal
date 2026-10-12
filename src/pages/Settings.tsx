import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Bell, Volume2, Trash2, Clock, UserX, Loader2, Timer } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { deleteAccountV2 } from '@/api/account';
import { SETTINGS_KEY, type AppSettings, loadSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Every localStorage key the app writes — kept in one place so wipes are total
// (the old reset missed the avatar, which can be an uploaded photo).
const ALL_LOCAL_KEYS = [
  'focusplanner_tasks',
  'focusplanner_stats',
  'focusplanner_profile',
  'focusplanner_avatar',
  SETTINGS_KEY,
];
function clearAllLocal() {
  ALL_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
}

const Settings = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  const resetAll = () => {
    clearAllLocal();
    window.location.reload();
  };

  // Full account erasure: server wipes Firestore data + the Auth record, then
  // we clear this device and sign out.
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccountV2();
      clearAllLocal();
      await signOut(auth).catch(() => {});
      toast.success('Account deleted');
      navigate('/login', { replace: true });
    } catch {
      toast.error("Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Settings</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Default Duration */}
          <div className="surface-elevated rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Default Focus Duration</Label>
                <p className="text-xs text-muted-foreground">Minutes per session</p>
              </div>
            </div>
            <Input
              type="number"
              min={1}
              max={480}
              value={settings.defaultDuration}
              onChange={e => update('defaultDuration', Math.max(1, Math.min(480, Number(e.target.value))))}
              className="w-20 h-9 text-center font-mono"
            />
          </div>

          {/* Notifications */}
          <div className="surface-elevated rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-accent" />
              <div>
                <Label className="text-sm font-semibold">Notifications</Label>
                <p className="text-xs text-muted-foreground">Session reminders</p>
              </div>
            </div>
            <Switch checked={settings.notifications} onCheckedChange={v => update('notifications', v)} />
          </div>

          {/* Sounds */}
          <div className="surface-elevated rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-accent" />
              <div>
                <Label className="text-sm font-semibold">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">Completion & alert sounds</p>
              </div>
            </div>
            <Switch checked={settings.sounds} onCheckedChange={v => update('sounds', v)} />
          </div>

          {/* Pomodoro */}
          <div className="surface-elevated rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-primary" />
                <div>
                  <Label className="text-sm font-semibold">Pomodoro Cycles</Label>
                  <p className="text-xs text-muted-foreground">
                    Focus in {settings.defaultDuration}-min blocks · 5-min breaks, long break every 4th.
                    Blocks under 20 min earn no points. Applies from the next session.
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.pomodoroEnabled}
                onCheckedChange={v => update('pomodoroEnabled', v)}
              />
            </div>
            {settings.pomodoroEnabled && (
              <div className="flex items-center justify-between pl-8">
                <div>
                  <Label className="text-sm font-semibold">Auto-start breaks</Label>
                  <p className="text-xs text-muted-foreground">Breaks and next blocks start themselves</p>
                </div>
                <Switch
                  checked={settings.pomodoroAutoBreak}
                  onCheckedChange={v => update('pomodoroAutoBreak', v)}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">Danger Zone</h2>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Trash2 className="w-4 h-4" /> Reset Local Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset data on this device?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clears tasks, stats, profile, avatar, and settings stored in this browser. Your account and leaderboard standing are kept. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetAll}>Reset this device</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2" disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently erases your account and all server data — profile, tasks, focus sessions, and every leaderboard entry — then signs you out. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); deleteAccount(); }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting…' : 'Delete everything'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
