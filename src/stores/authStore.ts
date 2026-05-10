import { create } from 'zustand'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@/types/database'

interface AuthState {
  supabaseUser: SupabaseUser | null
  profile: User | null
  isLoading: boolean
  setSupabaseUser: (user: SupabaseUser | null) => void
  setProfile: (profile: User | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  supabaseUser: null,
  profile: null,
  isLoading: true,
  setSupabaseUser: (user) => set({ supabaseUser: user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ supabaseUser: null, profile: null, isLoading: false }),
}))
