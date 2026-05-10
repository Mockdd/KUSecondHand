import type { SupabaseClient } from '@supabase/supabase-js'

import { ratingsToMannerTemperature } from '@/lib/trust/temperature'
import { isMutuallySatisfiedTransaction } from '@/lib/trust/success'

export type TrustMetrics = {
  manner_temperature: number
  successful_trade_count: number
}

export async function recomputeUserTrustMetrics(
  admin: SupabaseClient,
  uid: string,
): Promise<TrustMetrics> {
  const { data: received, error: revErr } = await admin
    .from('reviews')
    .select('rating')
    .eq('reviewee_uid', uid)

  if (revErr) throw new Error(revErr.message)

  const ratings = (received ?? []).map((r) => r.rating as number)
  const manner_temperature = ratingsToMannerTemperature(ratings)

  const { data: txs, error: txErr } = await admin
    .from('transactions')
    .select('transaction_id, buyer_uid, seller_uid, status')
    .eq('status', 'completed')
    .or(`buyer_uid.eq.${uid},seller_uid.eq.${uid}`)

  if (txErr) throw new Error(txErr.message)

  const list = txs ?? []
  const txIds = list.map((t) => t.transaction_id as number)
  let successful_trade_count = 0

  if (txIds.length > 0) {
    const { data: allReviews, error: allRevErr } = await admin
      .from('reviews')
      .select('transaction_id, reviewer_uid, reviewee_uid, rating')
      .in('transaction_id', txIds)

    if (allRevErr) throw new Error(allRevErr.message)

    const byTx = new Map<number, { reviewer_uid: string; reviewee_uid: string; rating: number }[]>()
    for (const r of allReviews ?? []) {
      const tid = r.transaction_id as number
      const arr = byTx.get(tid) ?? []
      arr.push({
        reviewer_uid: r.reviewer_uid as string,
        reviewee_uid: r.reviewee_uid as string,
        rating: r.rating as number,
      })
      byTx.set(tid, arr)
    }

    for (const t of list) {
      const tid = t.transaction_id as number
      const edges = byTx.get(tid) ?? []
      if (
        isMutuallySatisfiedTransaction(
          {
            buyer_uid: t.buyer_uid as string,
            seller_uid: t.seller_uid as string,
            status: t.status as string,
          },
          edges,
        )
      ) {
        successful_trade_count++
      }
    }
  }

  const { error: upErr } = await admin
    .from('users')
    .update({ manner_temperature, successful_trade_count })
    .eq('uid', uid)

  if (upErr) throw new Error(upErr.message)

  return { manner_temperature, successful_trade_count }
}

export async function recomputeAllUsersTrustMetrics(admin: SupabaseClient): Promise<{
  updated: number
  errors: string[]
}> {
  const errors: string[] = []
  const { data: rows, error } = await admin
    .from('users')
    .select('uid')
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  let updated = 0
  for (const row of rows ?? []) {
    const uid = row.uid as string
    try {
      await recomputeUserTrustMetrics(admin, uid)
      updated++
    } catch (e) {
      errors.push(`${uid}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { updated, errors }
}
