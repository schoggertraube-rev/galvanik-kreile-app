'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListTodo, Users, Package, AlertTriangle, TrendingUp, Archive, Settings, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { inquiriesRepository } from '@/lib/repositories/inquiriesRepository'

const SIDEBAR_ITEMS = [
  { name: 'Heute / Leitstand', path: '/', icon: LayoutDashboard },
  { name: 'Alle Aufträge', path: '/orders', icon: ListTodo },
  { name: 'Angebotsanfragen', path: '/quotes', icon: FileText },
  { name: 'Kundenkartei', path: '/customers', icon: Users },
  { name: 'Lager & Chemie', path: '/items', icon: Package },
  { name: 'Verzug & Engpässe', path: '/status', icon: AlertTriangle },
  { name: 'Performance', path: '/performance', icon: TrendingUp },
  { name: 'Kontrolle & Archiv', path: '/archive', icon: Archive },
]

export function Sidebar() {
  const pathname = usePathname()
  const [openQuotes, setOpenQuotes] = useState(0)

  useEffect(() => {
    const fetchQuotesCount = async () => {
      const count = await inquiriesRepository.getOpenCount()
      setOpenQuotes(count)
    }
    
    fetchQuotesCount()
    
    const handleUpdate = () => fetchQuotesCount()
    window.addEventListener('kreile-inquiries-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    
    return () => {
      window.removeEventListener('kreile-inquiries-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return (
    <aside className="w-64 border-r border-neutral-gray-100 bg-white hidden md:flex flex-col h-full shrink-0">
      <div className="flex-1 py-6 flex flex-col gap-1 px-3 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Übersicht
        </div>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/')
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-neutral-gray-100 text-navy-900 font-semibold' 
                  : 'text-text-muted hover:bg-bg-app-soft hover:text-navy-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${isActive ? 'text-navy-700' : 'text-text-muted'}`} />
                {item.name}
              </div>
              {item.path === '/quotes' && openQuotes > 0 && (
                <span className="bg-orange-100 text-accent-orange text-[10px] font-black px-2 py-0.5 rounded-full border border-accent-orange">
                  {openQuotes}
                </span>
              )}
            </Link>
          )
        })}
      </div>
      
      <div className="p-4 border-t border-neutral-gray-100">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-muted hover:bg-bg-app-soft hover:text-navy-900 transition-colors"
        >
          <Settings className="w-5 h-5 text-text-muted" />
          Einstellungen
        </Link>
      </div>
    </aside>
  )
}
