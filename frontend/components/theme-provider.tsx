"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      nonce={typeof window !== 'undefined' ? window.__webpack_nonce__ : undefined}
    >
      {children}
    </NextThemesProvider>
  )
}
