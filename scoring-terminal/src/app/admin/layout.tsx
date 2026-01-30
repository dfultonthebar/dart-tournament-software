'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import AdminSidebar from '@/components/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 lg:ml-0 min-w-0">
          {children}
        </div>
      </div>
    </AuthProvider>
  )
}
