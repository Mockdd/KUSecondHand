type Props = {
  trusted: boolean
  className?: string
}

export function TrustBadge({ trusted, className = '' }: Props) {
  if (!trusted) return null
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80 ${className}`}
      title="성공 거래 2회 이상(양쪽 만족 완료 기준)"
    >
      신뢰
    </span>
  )
}
