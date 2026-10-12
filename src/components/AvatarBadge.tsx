import { AvatarConfig, AVATAR_GRADIENTS } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** Renders the user's customized avatar: uploaded photo or emoji-on-gradient */
export function AvatarBadge({
  config,
  className,
  emojiClassName,
}: {
  config: AvatarConfig;
  className?: string;
  emojiClassName?: string;
}) {
  if (config.image) {
    return (
      <img
        src={config.image}
        alt="avatar"
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center select-none",
        className,
      )}
      style={{
        background:
          AVATAR_GRADIENTS[config.gradient % AVATAR_GRADIENTS.length],
      }}
    >
      <span className={cn("leading-none", emojiClassName)}>{config.emoji}</span>
    </div>
  );
}
