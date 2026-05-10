import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 대한민국 대략적 범위 (위도·경도) */
function isRoughlyKorea(lat: number, lon: number): boolean {
  return lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132
}

type NominatimAddress = Record<string, string>

/**
 * 좌표 → 역지오코딩(OSM Nominatim) → regions.name 과 매칭
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export async function POST(request: NextRequest) {
  let body: { latitude?: number; longitude?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const lat = Number(body.latitude)
  const lon = Number(body.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: '유효한 위도·경도가 필요합니다.' }, { status: 400 })
  }

  if (!isRoughlyKorea(lat, lon)) {
    return NextResponse.json(
      { error: '현재는 대한민국 내 위치만 활동 지역으로 설정할 수 있습니다.', code: 'OUT_OF_BOUNDS' },
      { status: 422 },
    )
  }

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse')
  nominatimUrl.searchParams.set('lat', String(lat))
  nominatimUrl.searchParams.set('lon', String(lon))
  nominatimUrl.searchParams.set('format', 'json')
  nominatimUrl.searchParams.set('accept-language', 'ko')

  const geoRes = await fetch(nominatimUrl.toString(), {
    headers: {
      'User-Agent': 'KU-Secondhand/1.0 (university marketplace; contact via site admin)',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!geoRes.ok) {
    return NextResponse.json(
      { error: '주소 변환 서비스에 연결하지 못했습니다.', detail: geoRes.statusText },
      { status: 502 },
    )
  }

  const geo = (await geoRes.json()) as {
    display_name?: string
    address?: NominatimAddress
    error?: string
  }

  if (geo.error) {
    return NextResponse.json({ error: geo.error }, { status: 422 })
  }

  const displayName = geo.display_name ?? ''
  const addr = geo.address ?? {}
  const haystack = [displayName, ...Object.values(addr)].filter(Boolean).join(' ')

  const supabase = await createClient()
  const { data: regions, error: regErr } = await supabase
    .from('regions')
    .select('region_id, name')
    .order('name', { ascending: false })

  if (regErr || !regions?.length) {
    return NextResponse.json({ error: '지역 목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  const sorted = [...regions].sort((a, b) => b.name.length - a.name.length)

  for (const r of sorted) {
    if (haystack.includes(r.name)) {
      return NextResponse.json({
        region_id: r.region_id,
        region_name: r.name,
        matched_by: 'exact_name_in_address',
      })
    }
  }

  const guMatch = haystack.match(/([가-힣]{2,8}구)/g)
  if (guMatch) {
    for (const token of guMatch) {
      const hit = sorted.find((r) => r.name === token || token.includes(r.name) || r.name.includes(token))
      if (hit) {
        return NextResponse.json({
          region_id: hit.region_id,
          region_name: hit.name,
          matched_by: 'gu_token',
        })
      }
    }
  }

  return NextResponse.json(
    {
      error:
        '주소에서 등록된 활동 지역과 일치하는 구·동을 찾지 못했습니다. 목록에서 직접 선택해 주세요.',
      code: 'NO_REGION_MATCH',
      hint: haystack.slice(0, 120),
    },
    { status: 404 },
  )
}
