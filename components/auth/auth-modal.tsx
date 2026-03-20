"use client"

import { useRouter } from "next/navigation"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export function AuthModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const homeHref = "/"

  function closeModal() {
    const referrer = document.referrer
    const isInternalReferrer = referrer.startsWith(window.location.origin)

    if (isInternalReferrer) {
      router.back()
      return
    }

    router.replace(homeHref)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeModal()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-fit border-0 bg-transparent p-0 ring-0"
      >
        <DialogTitle></DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
