'use client'

import { HousingType, HOUSING_TYPE_LABELS } from '@/types/recommend'

interface Props {
  value: HousingType | null
  onChange: (value: HousingType) => void
}

const OPTIONS: HousingType[] = ['dorm', 'flat']

export function HousingTypeSelector({ value, onChange }: Props) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">거주 형태</p>
      <div className="flex gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
              value === option
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
            }`}
          >
            {HOUSING_TYPE_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
