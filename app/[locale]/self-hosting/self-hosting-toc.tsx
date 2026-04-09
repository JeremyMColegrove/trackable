"use client"

import { T } from "gt-next"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

const sections = [
  { id: "step-1", label: <T key="1">What you need</T> },
  { id: "step-2", label: <T key="2">Auth configuration</T> },
  { id: "step-3", label: <T key="3">Email (optional)</T> },
  { id: "step-4", label: <T key="4">Database & Redis</T> },
  { id: "step-5", label: <T key="5">Configure .env</T> },
  { id: "step-6", label: <T key="6">Configure config.json</T> },
  { id: "step-7", label: <T key="7">Configure docker-compose.yml</T> },
  { id: "step-8", label: <T key="8">Start & Verify</T> },
]

export function SelfHostingTOC() {
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
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    )

    for (const { id } of sections) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Page sections">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <T>On this page</T>
      </p>
      <ul className="space-y-2">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={`block text-sm transition-colors hover:text-foreground ${
                activeId === id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <hr className="my-4 border-muted" />
      <Link
        href="/self-hosting/config"
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <T>Config Reference</T>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </nav>
  )
}
