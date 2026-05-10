/** 상품 → 판매자(users) 조인용 (schema: fk_products_seller) */
export const PRODUCT_SELLER_FIELDS =
  'uid, nickname, profile_image_url, manner_temperature, successful_trade_count'

export function productDetailSelect(): string {
  return `*, product_images(*), seller:users!fk_products_seller(${PRODUCT_SELLER_FIELDS})`
}

export function productListSelect(): string {
  return `*, product_images(*), seller:users!fk_products_seller(${PRODUCT_SELLER_FIELDS})`
}
