const { prisma } = require('../src/prisma')

const comments = [
  ['TABLE', 'products', '产品表'],
  ['COLUMN', 'products.id', '主键'],
  ['COLUMN', 'products.product_code', '产品编号'],
  ['COLUMN', 'products.product_name', '产品名称'],
  ['COLUMN', 'products.product_name_normalized', '产品名称标准化'],
  ['COLUMN', 'products.product_name_pinyin', '产品名称拼音'],
  ['COLUMN', 'products.product_name_initials', '产品名称首字母'],
  ['COLUMN', 'products.category_name', '产品分类名称'],
  ['COLUMN', 'products.default_unit', '默认单位'],
  ['COLUMN', 'products.tag', '标签'],
  ['COLUMN', 'products.remark', '备注'],
  ['COLUMN', 'products.source_file', '来源文件'],
  ['COLUMN', 'products.source_sheet', '来源工作表'],
  ['COLUMN', 'products.source_first_row_no', '来源首行号'],
  ['COLUMN', 'products.created_at', '创建时间'],
  ['COLUMN', 'products.updated_at', '更新时间'],
  ['COLUMN', 'products.all_sku_values', '全部SKU值'],
  ['TABLE', 'product_sku', '产品SKU表'],
  ['COLUMN', 'product_sku.id', '主键'],
  ['COLUMN', 'product_sku.product_id', '产品ID'],
  ['COLUMN', 'product_sku.warehouse_name', '仓库名称'],
  ['COLUMN', 'product_sku.barcode', '条码'],
  ['COLUMN', 'product_sku.sku_code', 'SKU编号'],
  ['COLUMN', 'product_sku.sku_value', 'SKU值'],
  ['COLUMN', 'product_sku.unit', '单位'],
  ['COLUMN', 'product_sku.sale_price', '销售价'],
  ['COLUMN', 'product_sku.opening_stock', '期初库存'],
  ['COLUMN', 'product_sku.min_stock', '最低库存'],
  ['COLUMN', 'product_sku.source_file', '来源文件'],
  ['COLUMN', 'product_sku.source_sheet', '来源工作表'],
  ['COLUMN', 'product_sku.source_row_no', '来源行号'],
  ['COLUMN', 'product_sku.created_at', '创建时间'],
  ['COLUMN', 'product_sku.updated_at', '更新时间']
]

function escapeComment(value) {
  return String(value).replace(/'/g, "''")
}

async function createSearchIndexes() {
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm')
  } catch (error) {
    const message = (error && error.meta && error.meta.message) || (error && error.message) || String(error)
    console.warn(`[setup-products-db] skip trigram indexes: ${message.split('\n')[0]}`)
    return
  }
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_products_name_trgm" ON public.products USING gin (product_name gin_trgm_ops)')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_products_product_name" ON public.products USING btree (product_name)')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_products_sku_values_trgm" ON public.products USING gin (all_sku_values gin_trgm_ops)')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "products_product_name_normalized_gin_idx" ON public.products USING gin (product_name_normalized gin_trgm_ops)')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "product_sku_sku_value_idx" ON public.product_sku USING gin (sku_value gin_trgm_ops)')
}

async function createSkuSyncTrigger() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.fn_sync_product_sku_values()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE public.products p
        SET all_sku_values = COALESCE((
          SELECT string_agg(v.sku_value, ' ' ORDER BY v.sku_value)
          FROM (
            SELECT DISTINCT trim(s.sku_value) AS sku_value
            FROM public.product_sku s
            WHERE s.product_id = OLD.product_id
              AND nullif(trim(coalesce(s.sku_value, '')), '') IS NOT NULL
          ) v
        ), ''),
        updated_at = now()
        WHERE p.id = OLD.product_id;
      END IF;

      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE public.products p
        SET all_sku_values = COALESCE((
          SELECT string_agg(v.sku_value, ' ' ORDER BY v.sku_value)
          FROM (
            SELECT DISTINCT trim(s.sku_value) AS sku_value
            FROM public.product_sku s
            WHERE s.product_id = NEW.product_id
              AND nullif(trim(coalesce(s.sku_value, '')), '') IS NOT NULL
          ) v
        ), ''),
        updated_at = now()
        WHERE p.id = NEW.product_id;
      END IF;

      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `)
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_sync_product_sku_values ON public.product_sku')
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_sync_product_sku_values
    AFTER INSERT OR UPDATE OF sku_value, product_id OR DELETE ON public.product_sku
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_sync_product_sku_values();
  `)
}

async function createChineseViews() {
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.product_sku_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.products_cn')
  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.products_cn AS
    SELECT
      id AS "ID",
      product_code AS "产品编号",
      product_name AS "产品名称",
      product_name_normalized AS "产品名称标准化",
      product_name_pinyin AS "产品名称拼音",
      product_name_initials AS "产品名称首字母",
      category_name AS "产品分类",
      default_unit AS "默认单位",
      tag AS "标签",
      remark AS "备注",
      source_file AS "来源文件",
      source_sheet AS "来源工作表",
      source_first_row_no AS "来源首行号",
      all_sku_values AS "全部SKU值",
      created_at AS "创建时间",
      updated_at AS "更新时间"
    FROM public.products;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.products_cn IS '产品表中文字段视图，只用于查看数据，不作为业务写入入口'`)

  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.product_sku_cn AS
    SELECT
      s.id AS "ID",
      s.product_id AS "产品ID",
      p.product_code AS "产品编号",
      p.product_name AS "产品名称",
      s.warehouse_name AS "仓库名称",
      s.barcode AS "条码",
      s.sku_code AS "SKU编号",
      s.sku_value AS "SKU值",
      s.unit AS "单位",
      s.sale_price AS "销售价",
      s.opening_stock AS "期初库存",
      s.min_stock AS "最低库存",
      s.source_file AS "来源文件",
      s.source_sheet AS "来源工作表",
      s.source_row_no AS "来源行号",
      s.created_at AS "创建时间",
      s.updated_at AS "更新时间"
    FROM public.product_sku s
    LEFT JOIN public.products p ON p.id = s.product_id;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.product_sku_cn IS '产品SKU中文字段视图，只用于查看数据，不作为业务写入入口'`)
}

async function createComments() {
  for (const [kind, target, comment] of comments) {
    await prisma.$executeRawUnsafe(`COMMENT ON ${kind} ${target} IS '${escapeComment(comment)}'`)
  }
}

async function main() {
  await createSearchIndexes()
  await createSkuSyncTrigger()
  await createChineseViews()
  await createComments()
  console.log(`[setup-products-db] ok views=products_cn,product_sku_cn comments=${comments.length}`)
}

main()
  .catch(error => {
    console.error('[setup-products-db] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
