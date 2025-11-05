import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dart Scoring Terminal',
  description: 'WAMO Dart Tournament Scoring System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="no-select">{children}</body>
    </html>
  )
}
