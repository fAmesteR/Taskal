// Local-first avatar customization: an uploaded image (stored as a small
// data URL) or an emoji on a gradient. Persisted in localStorage.

const AVATAR_KEY = "focusplanner_avatar";

export interface AvatarConfig {
  /** Resized data-URL of an uploaded photo; takes priority when set */
  image?: string | null;
  emoji: string;
  gradient: number;
}

export const AVATAR_EMOJIS = [
  "🔥", "⚡", "🎯", "🧠", "🚀", "🌙", "🦉", "🐺",
  "🏔️", "🌊", "💎", "👾", "🥷", "🤖", "🦅", "🍀",
];

export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #14b8a6, #0ea5e9)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #22c55e, #14b8a6)",
  "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  "linear-gradient(135deg, #f43f5e, #f97316)",
  "linear-gradient(135deg, #06b6d4, #6366f1)",
  "linear-gradient(135deg, #eab308, #84cc16)",
];

export const DEFAULT_AVATAR: AvatarConfig = {
  image: null,
  emoji: "🎯",
  gradient: 0,
};

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : { ...DEFAULT_AVATAR };
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function saveAvatar(config: AvatarConfig) {
  localStorage.setItem(AVATAR_KEY, JSON.stringify(config));
}

/** Resize an uploaded image to a small square data URL (~10–20 KB) */
export function fileToAvatarDataUrl(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    // Guard before decoding: reject non-images and oversized files so a huge
    // upload can't OOM the tab. The canvas re-encode below also strips any
    // embedded payload, so the stored avatar is always a clean re-rendered JPEG.
    if (!file.type.startsWith("image/"))
      return reject(new Error("not an image"));
    if (file.size > 8 * 1024 * 1024)
      return reject(new Error("image too large (max 8 MB)"));

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      // cover-crop to a centered square
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read image"));
    };
    img.src = url;
  });
}
