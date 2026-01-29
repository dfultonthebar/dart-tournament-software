import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tournament Brackets',
  description: 'WAMO Dart Tournament Bracket Display',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
