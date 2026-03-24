"use client"

import { useEffect, useMemo, useState } from "react"

export default function GoogleLoginRedirect() {
  const [error, setError] = useState<string | null>(null)

  const apiBase = useMemo(() => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL
    if (envBase) return envBase
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return "http://localhost:8000"
    }
    return ""
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!apiBase) {
      setError("Missing API base URL. Set NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_API_BASE) and restart the dev server.")
      return
    }
    const target = `${apiBase}/auth/google/login`
    // Avoid redirect loops if already on target host/path
    if (window.location.href === target) return
    window.location.replace(target)
  }, [apiBase])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f1115]">
        <div className="max-w-md text-center text-gray-700 dark:text-gray-200">
          <h1 className="text-lg font-semibold mb-2">Google sign-in setup needed</h1>
          <p className="text-sm">{error}</p>
        </div>
      </main>
    )
  }

  return null
}
