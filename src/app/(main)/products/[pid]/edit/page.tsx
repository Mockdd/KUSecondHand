export default async function EditProductPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">상품 수정</h1>
      <p className="text-sm text-gray-400">pid: {pid}</p>
      {/* TODO: Phase 3 — 상품 수정 폼 구현 */}
    </div>
  )
}
