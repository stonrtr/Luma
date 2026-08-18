import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const photoUrl =
    avatarUrl || `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(name)}`;

  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={photoUrl} alt={name} />
      <AvatarFallback
        className={cn("font-medium text-white", avatarColor(name))}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
