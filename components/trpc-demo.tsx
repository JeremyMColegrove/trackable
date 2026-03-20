"use client"

import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/trpc/client"
import { T } from "gt-next";

export function TRPCDemo() {
  const trpc = useTRPC()
  const helloQuery = useQuery(
    trpc.hello.queryOptions({
      text: "trackable",
    })
  )

  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium"><T>tRPC quickstart check</T></p>
      <p className="text-muted-foreground">
        {helloQuery.data?.greeting ?? "Loading greeting..."}
      </p>
    </div>
  )
}
