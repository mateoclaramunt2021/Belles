'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Usuario | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // DEMO MODE: si Supabase no está configurado, simular admin logueado
  const isDemoMode = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('TU-PROYECTO') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL

  const demoProfile: Usuario = {
    id: 'demo',
    email: 'admin@belles.com.uy',
    nombre: 'Admin Demo',
    rol: 'admin',
    activo: true,
    created_at: new Date().toISOString(),
  }

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }, [supabase])

  useEffect(() => {
    // En demo mode, simular admin directamente
    if (isDemoMode) {
      setProfile(demoProfile)
      setLoading(false)
      return
    }

    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) await fetchProfile(user.id)
      setLoading(false)
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin: profile?.rol === 'admin',
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
