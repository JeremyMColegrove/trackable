"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function getInitials(name: string | null, email: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return email?.[0]?.toUpperCase() ?? "?"
}

type UserAvatarProps = {
  alt?: string | null
  className?: string
  email?: string | null
  fallbackClassName?: string
  imageUrl?: string | null
  name?: string | null
}

export function UserAvatar({
  alt,
  className,
  email = null,
  fallbackClassName,
  imageUrl = null,
  name = null,
}: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={alt ?? name ?? email ?? ""} /> : null}
      <AvatarFallback
        delayMs={imageUrl ? 300 : undefined}
        className={cn(fallbackClassName)}
      >
        {getInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  )
}
