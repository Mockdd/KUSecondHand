/** 프로필 동물 아바타 5종 — `uid`마다 고정(해시), 업로드 대신 사용 */
export const PROFILE_ANIMAL_LABELS = ['돌고래', '강아지', '코뿔소', '말', '소'] as const

export function profileAnimalIndex(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) {
    h = (h * 31 + uid.charCodeAt(i)) >>> 0
  }
  return h % PROFILE_ANIMAL_LABELS.length
}

export function profileAnimalLabel(uid: string): string {
  return PROFILE_ANIMAL_LABELS[profileAnimalIndex(uid)]
}

export function profileAnimalImageSrc(uid: string): string {
  return `/profile-animals/${profileAnimalIndex(uid)}.svg`
}
