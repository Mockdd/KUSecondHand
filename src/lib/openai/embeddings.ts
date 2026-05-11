import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * 텍스트를 1536차원 embedding 벡터로 변환
 * 모델: text-embedding-3-small ($0.02/1M tokens)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // 토큰 한도 방어
  })
  return response.data[0].embedding
}

/**
 * 매물 등록/수정 시 embedding 텍스트 조합
 */
export function buildProductEmbeddingText(title: string, description?: string | null): string {
  return [title, description].filter(Boolean).join(' ')
}

/**
 * 패키지 embedding 텍스트 조합
 */
export function buildPackageEmbeddingText(nameKo: string, nameEn: string): string {
  return `${nameKo} ${nameEn}`
}
