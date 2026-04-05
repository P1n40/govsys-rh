'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { MANAGER_ROLES, listUsuarios, type UserRole, type Usuario } from '@/lib/services/govsys'

type GovContextType = {
  users: Usuario[]
  currentUser: Usuario | null
  strictSLA: boolean
  isManager: boolean
  hasManager: boolean
  canManage: boolean
  loadingUsers: boolean
  switchUser: () => void
  refreshUsers: () => Promise<void>
  setStrictSLA: (value: boolean) => void
}

const GovContext = createContext<GovContextType | null>(null)

const STRICT_KEY = 'govsys.strict_sla'
const USER_KEY = 'govsys.current_user'

export function GovProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<Usuario[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [strictSLA, setStrictSLAState] = useState<boolean>(false)
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true)

  useEffect(() => {
    const strict = window.localStorage.getItem(STRICT_KEY)
    if (strict === '1') setStrictSLAState(true)
    const savedUser = window.localStorage.getItem(USER_KEY)
    if (savedUser) setCurrentUserId(savedUser)
  }, [])

  const refreshUsers = useCallback(async () => {
    try {
      setLoadingUsers(true)
      const data = await listUsuarios()
      setUsers(data)
      setCurrentUserId((prev) => prev ?? data[0]?.id ?? null)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    void refreshUsers()
  }, [refreshUsers])

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? users[0] ?? null,
    [currentUserId, users]
  )

  useEffect(() => {
    if (currentUser?.id) {
      window.localStorage.setItem(USER_KEY, currentUser.id)
    }
  }, [currentUser?.id])

  function switchUser() {
    if (users.length < 2 || !currentUser) return
    const index = users.findIndex((u) => u.id === currentUser.id)
    const next = users[(index + 1) % users.length]
    setCurrentUserId(next.id)
  }

  function setStrictSLA(value: boolean) {
    setStrictSLAState(value)
    window.localStorage.setItem(STRICT_KEY, value ? '1' : '0')
  }

  const isManager = Boolean(currentUser?.role && MANAGER_ROLES.includes(currentUser.role))
  const hasManager = users.some((u) => MANAGER_ROLES.includes(u.role))
  const canManage = isManager || !hasManager

  return (
    <GovContext.Provider
      value={{
        users,
        currentUser,
        strictSLA,
        isManager,
        hasManager,
        canManage,
        loadingUsers,
        switchUser,
        refreshUsers,
        setStrictSLA,
      }}
    >
      {children}
    </GovContext.Provider>
  )
}

export function useGovContext(): GovContextType {
  const ctx = useContext(GovContext)
  if (!ctx) throw new Error('useGovContext must be used within GovProvider')
  return ctx
}

export function isManagerRole(role: UserRole | undefined): boolean {
  return Boolean(role && MANAGER_ROLES.includes(role))
}
