"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

type CodeBlockProps = {
  code: string
  label: string
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)

    window.setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  return (
    <div className="relative my-6 overflow-hidden rounded-xl border bg-muted shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2">
        <span className="truncate pr-2 text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleCopy()}
          className="h-7 shrink-0 text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="overflow-x-auto p-4 text-sm text-foreground">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
