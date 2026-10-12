// Shared app settings — persisted in localStorage under the existing key.
// Extracted from pages/Settings.tsx so non-page code (FocusTimer) can read it.

export const SETTINGS_KEY = "focusplanner_settings";

export interface AppSettings {
  defaultDuration: number;
  notifications: boolean;
  sounds: boolean;
  /** Pomodoro cycles: split focus into blocks with timed breaks. Off by default. */
  pomodoroEnabled: boolean;
  /** Auto-start breaks and the next block (reference behavior). */
  pomodoroAutoBreak: boolean;
}

export const defaultSettings: AppSettings = {
  defaultDuration: 25,
  notifications: true,
  sounds: true,
  pomodoroEnabled: false,
  pomodoroAutoBreak: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}
