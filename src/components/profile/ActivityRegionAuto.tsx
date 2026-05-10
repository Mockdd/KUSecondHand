'use client'

import { useState } from 'react'

type Props = {
  disabled?: boolean
  onResolved: (regionId: number, regionName: string) => void
}

export function ActivityRegionAuto({ disabled, onResolved }: Props) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setMsg(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoading(false)
      setMsg('이 브라우저에서는 위치 정보를 사용할 수 없습니다.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch('/api/regions/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ latitude, longitude }),
          })

          const json = (await res.json().catch(() => ({}))) as {
            region_id?: number
            region_name?: string
            error?: string
          }

          if (!res.ok) {
            setMsg(json.error ?? '지역을 찾지 못했습니다.')
            setLoading(false)
            return
          }

          if (json.region_id != null && json.region_name) {
            onResolved(json.region_id, json.region_name)
            setMsg(`「${json.region_name}」으로 활동 지역을 맞췄습니다. 저장을 눌러 반영하세요.`)
          }
        } catch {
          setMsg('요청에 실패했습니다.')
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setLoading(false)
        const code = err.code
        if (code === 1) {
          setMsg('위치 권한이 거부되었습니다. 브라우저 설정에서 위치를 허용해 주세요.')
        } else if (code === 2) {
          setMsg('위치를 확인할 수 없습니다.')
        } else if (code === 3) {
          setMsg('위치 확인 시간이 초과되었습니다.')
        } else {
          setMsg('위치를 가져오지 못했습니다.')
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    )
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">활동 지역 자동 설정</h3>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">
          기기 GPS·Wi‑Fi 기반 대략 위치를 사용합니다. 정밀 좌표는 저장하지 않고, 지역 목록과만
          매칭합니다. 서버에서 주소로 변환할 때 외부 지오코딩(OSM Nominatim)을 사용합니다.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={disabled || loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? '위치 확인 중…' : '현재 위치로 활동 지역 맞추기'}
      </button>
      {msg ? (
        <p
          className={`text-sm ${msg.includes('맞췄') ? 'text-emerald-800' : 'text-amber-800'}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </div>
  )
}
