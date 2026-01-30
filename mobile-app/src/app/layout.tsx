import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dart Mobile App',
  description: 'WAMO Dart Tournament Mobile App',
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
