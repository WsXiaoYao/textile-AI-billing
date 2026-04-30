const fs = require('fs')
const path = require('path')

function parseJsonArray(text) {
  const start = text.indexOf('[')
  if (start < 0) throw new Error('没有找到产品 JSON 数组')
  return JSON.parse(text.slice(start))
}

function text(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function toNumber(value) {
  const normalized = text(value).replace(/,/g, '')
  if (!normalized || normalized === '-') return 0
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function toCents(value) {
  return Math.round(toNumber(value) * 100)
}

function getColorHex(name) {
  const source = text(name)
  if (/米|白|浅米|米白/.test(source)) return '#F4E8D0'
  if (/深灰|黑/.test(source)) return '#3F4652'
  if (/浅灰|灰/.test(source)) return '#B7C0CA'
  if (/灰蓝|蓝|牛仔/.test(source)) return '#8DB7D9'
  if (/绿|橄榄/.test(source)) return '#77A77A'
  if (/咖|棕|褐/.test(source)) return '#A77858'
  if (/黄|金/.test(source)) return '#E8B94F'
  if (/橙/.test(source)) return '#E9964A'
  if (/粉|红/.test(source)) return '#E99AAE'
  return '#DDE6F0'
}

function makeProductId(no, name, index) {
  const key = text(no) || text(name) || `P${index + 1}`
  return encodeURIComponent(key).replace(/%/g, '')
}

function makeVariant(row, index, product) {
  const colorName = text(row['颜色']) || text(row['色号']) || '默认'
  const colorNo = text(row['色号'])
  const unit = text(row['单位']) || product.unit || '件'
  const stockQty = toNumber(row['期初库存'])
  const lowerLimitQty = toNumber(row['库存下限'])
  const priceCents = toCents(row['售价'])

  return {
    id: `${product.id}-${index + 1}`,
    color: colorName,
    colorNo,
    unit,
    stockQty,
    lowerLimitQty,
    priceCents,
    priceText: priceCents ? `¥${(priceCents / 100).toFixed(priceCents % 100 ? 2 : 0)}` : '未定价',
    swatch: getColorHex(colorName),
    warning: lowerLimitQty > 0 && stockQty <= lowerLimitQty
  }
}

function buildProducts(rows) {
  const products = []
  let current = null

  rows.forEach((row, rowIndex) => {
    const name = text(row['名称'])

    if (name) {
      const product = {
        id: makeProductId(row['产品编号'], name, products.length),
        name,
        no: text(row['产品编号']) || `P${String(products.length + 1).padStart(4, '0')}`,
        category: text(row['产品分类']) || '未分类',
        warehouse: text(row['仓库']) || '默认仓',
        unit: text(row['单位']) || '件',
        tag: text(row['标签']),
        remark: text(row['备注']),
        variants: []
      }
      products.push(product)
      current = product
    }

    if (!current) return
    current.variants.push(makeVariant(row, current.variants.length, current))
  })

  return products.map(product => {
    const validPrices = product.variants
      .map(variant => variant.priceCents)
      .filter(price => price > 0)
    const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockQty, 0)
    const warningCount = product.variants.filter(variant => variant.warning).length
    const colorNames = product.variants.map(variant => variant.color).filter(Boolean)
    const minPriceCents = validPrices.length ? Math.min(...validPrices) : 0
    const maxPriceCents = validPrices.length ? Math.max(...validPrices) : 0

    return {
      ...product,
      colorCount: product.variants.length,
      colorPreview: colorNames.slice(0, 4),
      totalStock,
      warningCount,
      minPriceCents,
      maxPriceCents
    }
  })
}

function main() {
  const input = process.argv[2]
  const output = process.argv[3]

  if (!input || !output) {
    console.error('Usage: node tools/build-product-seed.js <xlsx-cli-json> <output-js>')
    process.exit(1)
  }

  const rows = parseJsonArray(fs.readFileSync(input, 'utf8'))
  const products = buildProducts(rows)
  const outPath = path.resolve(output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [
      '// Generated from 产品列表20260213214207.xls. Do not edit by hand.',
      `// Total products: ${products.length}`,
      `module.exports = ${JSON.stringify(products, null, 2)}`,
      ''
    ].join('\n'),
    'utf8'
  )
  console.log(`Generated ${products.length} products -> ${outPath}`)
}

main()
