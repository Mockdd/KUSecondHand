import Image from 'next/image'

import { profileAnimalImageSrc, profileAnimalLabel } from '@/lib/profile/animalAvatar'

type Props = {
  uid: string
  /** Tailwind size class for wrapper, e.g. h-28 w-28 */
  className?: string
}

export function ProfileAnimalAvatar({ uid, className = 'h-28 w-28' }: Props) {
  const src = profileAnimalImageSrc(uid)
  const alt = `${profileAnimalLabel(uid)} 캐릭터 프로필`

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="112px"
        unoptimized
        priority={false}
      />
    </div>
  )
}
