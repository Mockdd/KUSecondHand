'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HygienePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/sell/template')
  }, [router])
  return null
}
