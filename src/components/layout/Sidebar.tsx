'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListTodo, Users, Package, AlertTriangle, TrendingUp, Archive, Settings, FileText } from 'lucide-react'

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

  return (
    <aside className="w-64 border-r border-slate-200 bg-white hidden md:flex flex-col h-full shrink-0">
      <div className="flex-1 py-6 flex flex-col gap-1 px-3 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Übersicht
        </div>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/')
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-slate-100 text-blue-900 font-semibold' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </div>
      
      <div className="p-4 border-t border-slate-200">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <Settings className="w-5 h-5 text-slate-400" />
          Einstellungen
        </Link>
      </div>
    </aside>
  )
}
