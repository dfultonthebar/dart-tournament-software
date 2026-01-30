'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Scoring terminal error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
        <p className="text-gray-300 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="btn-touch btn-primary px-6 py-3 font-bold"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
