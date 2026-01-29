'use client'

import { AuthProvider } from '@/contexts/AuthContext'

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
