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
    console.error('Display terminal error:', error)
  }, [error])

  // Auto-retry after 10 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      reset()
    }, 10000)
    return () => clearTimeout(timeout)
  }, [reset])

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-black text-white">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Display Error</h2>
        <p className="text-gray-300 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white transition-colors"
        >
          Retry
        </button>
        <p className="text-gray-500 text-sm mt-4">
          This page will auto-retry in 10 seconds.
        </p>
      </div>
    </div>
  )
}
