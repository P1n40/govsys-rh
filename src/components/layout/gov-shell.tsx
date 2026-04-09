'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, LayoutDashboard, PlusCircle, Users, BarChart3, ShieldCheck, UserCircle, Menu, X, LogOut, MessagesSquare } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useGovContext } from '@/components/providers/gov-provider'
import { MANAGER_ROLES } from '@/lib/services/govsys'

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/demandas', label: 'Demandas', icon: FileText },
  { href: '/nova-demanda', label: 'Nova Demanda', icon: PlusCircle },
  { href: '/mensagens', label: 'Mensagens', icon: MessagesSquare },
  { href: '/relatorios', label: 'Relatorios', icon: BarChart3 },
  { href: '/equipe', label: 'Gestao de Equipe', icon: Users },
]

const LIMITED_NAV_ITEMS: NavItem[] = [
  { href: '/demandas', label: 'Demandas', icon: FileText },
  { href: '/nova-demanda', label: 'Nova Demanda', icon: PlusCircle },
  { href: '/mensagens', label: 'Mensagens', icon: MessagesSquare },
]

export default function GovShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, switchUser, loadingUsers } = useGovContext()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isBelowSupervisor = Boolean(currentUser?.role && !MANAGER_ROLES.includes(currentUser.role))
  const navItems = isBelowSupervisor ? LIMITED_NAV_ITEMS : NAV_ITEMS

  useEffect(() => {
    if (loadingUsers || !isBelowSupervisor || !pathname) return

    const allowed =
      pathname === '/demandas' ||
      pathname.startsWith('/demandas/') ||
      pathname === '/nova-demanda' ||
      pathname.startsWith('/nova-demanda/') ||
      pathname === '/mensagens' ||
      pathname.startsWith('/mensagens/')

    if (!allowed) {
      router.replace('/demandas')
    }
  }, [isBelowSupervisor, loadingUsers, pathname, router])

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 lg:flex">
      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-900 text-slate-100 shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">HR GovSys</h1>
              <p className="text-xs text-slate-400">Governanca Operacional</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <p className="truncate text-sm font-semibold text-white">{currentUser?.nome ?? 'Usuario'}</p>
          <p className="mb-3 text-xs text-blue-300">{currentUser?.role ?? '-'}</p>
          <button
            onClick={switchUser}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 py-2 text-xs text-slate-200 hover:bg-slate-700"
          >
            <UserCircle className="h-4 w-4" />
            Trocar Perfil
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-red-300 hover:bg-slate-800">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="w-full lg:ml-0">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="h-6 w-6 text-slate-600" />
              </button>
              <p className="hidden text-sm text-slate-600 sm:block">Todas as acoes sao monitoradas e auditaveis.</p>
              <p className="text-xs text-slate-500 sm:hidden">Acoes auditaveis</p>
            </div>
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 sm:inline-flex">
              Sistema Operacional
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
