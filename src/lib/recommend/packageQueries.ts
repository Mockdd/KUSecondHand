import { SupabaseClient } from '@supabase/supabase-js'
import {
  CategoryWithProducts,
  HousingType,
  PackageTemplate,
  ProductSummary,
} from '@/types/recommend'

function templateSpecificity(t: PackageTemplate): number {
  return (
    (t.major_id !== null ? 8 : 0) +
    (t.grade !== null ? 4 : 0) +
    (t.housing_type !== null ? 2 : 0) +
    (t.semester !== null ? 1 : 0)
  )
}

export async function fetchMatchingTemplate(
  supabase: SupabaseClient,
  params: {
    major_id: number | null
    grade: number | null
    housing_type: HousingType | null
    semester: string
  }
): Promise<PackageTemplate | null> {
  let query = supabase.from('package_templates').select('*')

  // 사용자 값이 있으면 "값 일치 OR NULL" / 없으면 "NULL만" 매칭
  if (params.major_id !== null) {
    query = query.or(`major_id.is.null,major_id.eq.${params.major_id}`)
  } else {
    query = query.is('major_id', null)
  }

  if (params.grade !== null) {
    query = query.or(`grade.is.null,grade.eq.${params.grade}`)
  } else {
    query = query.is('grade', null)
  }

  if (params.housing_type !== null) {
    query = query.or(`housing_type.is.null,housing_type.eq.${params.housing_type}`)
  } else {
    query = query.is('housing_type', null)
  }

  query = query.or(`semester.is.null,semester.eq.${params.semester}`)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  // 가장 구체적으로 매칭된 템플릿 선택
  const sorted = [...data].sort(
    (a, b) => templateSpecificity(b) - templateSpecificity(a)
  )
  return sorted[0]
}

async function fetchTemplateCategories(
  supabase: SupabaseClient,
  templateId: number
): Promise<{ category_id: number; category_name: string; required_quantity: number; priority_order: number }[]> {
  const { data, error } = await supabase
    .from('package_template_items')
    .select(`
      category_id,
      required_quantity,
      priority_order,
      categories(name)
    `)
    .eq('package_template_id', templateId)
    .order('priority_order')

  if (error || !data) return []

  return data.map((item) => ({
    category_id: item.category_id,
    category_name: (item.categories as unknown as { name: string } | null)?.name ?? '기타',
    required_quantity: item.required_quantity,
    priority_order: item.priority_order,
  }))
}

async function fetchProductsByCategory(
  supabase: SupabaseClient,
  categoryId: number
): Promise<ProductSummary[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      pid,
      title,
      price,
      condition,
      product_images(image_url, display_order)
    `)
    .eq('category_id', categoryId)
    .eq('status', 'selling')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !data) return []

  return data.map((p) => {
    const images = (p.product_images ?? []) as { image_url: string; display_order: number }[]
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order)
    return {
      pid: p.pid,
      title: p.title,
      price: p.price,
      condition: p.condition,
      image_url: sorted[0]?.image_url ?? null,
    }
  })
}

export async function buildPackageResult(
  supabase: SupabaseClient,
  templateId: number
): Promise<CategoryWithProducts[]> {
  const items = await fetchTemplateCategories(supabase, templateId)

  return Promise.all(
    items.map(async (item) => {
      const products = await fetchProductsByCategory(supabase, item.category_id)
      return { ...item, products }
    })
  )
}
