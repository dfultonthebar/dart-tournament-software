'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerRegisterRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/register?mode=player')
  }, [router])

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <p>Redirecting to registration...</p>
    </main>
  )
}
