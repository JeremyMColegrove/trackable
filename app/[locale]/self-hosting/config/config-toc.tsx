"use client"

import { T } from "gt-next"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

const sections = [
  "admins",
  "auth",
  "features",
  "limits",
  "billing",
  "webhooks",
  "batch",
]

export function ConfigTOC() {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    )

    for (const id of sections) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Config sections">
      <Link
        href="/self-hosting"
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <T>Guide</T>
      </Link>
      <hr className="mb-4 border-muted" />
      <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <T>Sections</T>
      </p>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section}>
            <a
              href={`#${section}`}
              className={`block font-mono text-sm transition-colors hover:text-foreground ${
                activeId === section
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {section}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
