'use client'

import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav className="flex items-center gap-2 text-sm mb-6 flex-wrap" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <span className="text-gray-500">/</span>}
            {isLast || !item.href ? (
              <span className="text-white font-medium">{item.label}</span>
            ) : (
              <Link href={item.href} className="text-gray-400 hover:text-white transition-colors no-underline">
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
