/**
 * DeepL API 번역 래퍼
 *
 * - DEEPL_API_KEY 미설정 시 null 반환 (번역 없이 원문만 표시)
 * - 번역 실패 시 null 반환 — 호출부에서 원문으로 폴백
 * - 무료 플랜: api-free.deepl.com, 유료 플랜: api.deepl.com
 *
 * 환경변수:
 *   DEEPL_API_KEY=your-deepl-auth-key
 */

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate'

const LANG_MAP: Record<'ko' | 'en', string> = {
  ko: 'KO',
  en: 'EN-US',
}

/**
 * 텍스트 번역
 * @param text       원문
 * @param targetLang 번역 대상 언어
 * @returns          번역문 또는 null (실패 시)
 */
export async function translateText(
  text: string,
  targetLang: 'ko' | 'en'
): Promise<string | null> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return null
  if (!text.trim()) return null

  try {
    const res = await fetch(DEEPL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: LANG_MAP[targetLang],
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      translations: { text: string }[]
    }
    return data.translations[0]?.text ?? null
  } catch {
    return null
  }
}
