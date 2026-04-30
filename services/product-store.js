const productStorageKey = 'textile_product_profiles_v1'
const productTaskStorageKey = 'textile_product_import_export_tasks_v1'
const productCategoryStorageKey = 'textile_product_categories_v1'
const variantDefaultImage = '/assets/products/variant-default.svg'
const productDefaultImage = '/assets/products/product-default.svg'
const productSeed = require('../data/product-seed')

let cachedProducts
let cachedTasks
let cachedCategoryRecords

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function formatDateTime(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatMoney(cents) {
  const absCents = Math.abs(Number(cents || 0))
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const decimalText = fen ? `.${String(fen).padStart(2, '0')}` : ''
  const sign = cents < 0 ? '-' : ''
  return `${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimalText}`
}

function parseAmountInput(value) {
  const normalized = String(value || '').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const parts = normalized.split('.')
  const yuan = Number(parts[0] || 0)
  const fen = Number(String(parts[1] || '').slice(0, 2).padEnd(2, '0') || 0)
  if (Number.isNaN(yuan) || Number.isNaN(fen)) return 0
  return yuan * 100 + fen
}

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatNumber(value) {
  const numberValue = Number(value || 0)
  if (!numberValue) return '0'
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function getPriceRange(product) {
  if (!product.minPriceCents && !product.maxPriceCents) return '未定价'
  if (product.minPriceCents === product.maxPriceCents) return formatMoney(product.minPriceCents)
  return `${formatMoney(product.minPriceCents)}-${formatMoney(product.maxPriceCents)}`
}

function getProductCoverText(product) {
  const noText = String(product.no || '').replace(/[^\dA-Za-z]/g, '')
  if (/^\d{1,3}$/.test(noText)) return noText
  const nameText = String(product.name || product.category || '品')
  return nameText.slice(0, 2)
}

function getEstimatedCostCents(priceCents) {
  const normalized = Number(priceCents || 0)
  if (!normalized) return 0
  return Math.max(1, Math.round(normalized * 0.73))
}

function getVariantImage(product, variant) {
  return variant.imageUrl ||
    variant.imagePath ||
    variant.pictureUrl ||
    variant.photoUrl ||
    variant.coverUrl ||
    product.variantImageUrl ||
    variantDefaultImage
}

function getVariantDefaultImage() {
  return variantDefaultImage
}

function getProductImage(product) {
  return product.imageUrl ||
    product.imagePath ||
    product.productImageUrl ||
    product.coverImage ||
    product.coverUrl ||
    product.pictureUrl ||
    productDefaultImage
}

function getProductDefaultImage() {
  return productDefaultImage
}

function inferCategoryPath(product) {
  const category = product.category || '未分类'
  const name = product.name || ''
  const text = `${category} ${name}`

  if (/寸布|通用寸|玛寸/.test(text)) return ['面料', '寸布', category]
  if (/法国绒|绒|珊瑚|水貂|奥阳|复合/.test(text)) return ['面料', '绒布', category]
  if (/网|纱|蕾丝|雪纺|棉布|印花/.test(text)) return ['面料', '薄料', category]
  if (/辅料|膜|胶|线|扣|拉链|包装|袋/.test(text)) return ['辅料', '包装与工具', category]
  if (/成品|枕|垫|套|毯/.test(text)) return ['成品', '家纺成品', category]
  return ['其他', '未归类', category]
}

function normalizeProduct(product) {
  const variants = (product.variants || []).map((variant, index) => {
    const unit = variant.unit || product.unit || '件'
    const priceCents = Number(variant.priceCents || 0)
    const costPriceCents = Number(variant.costPriceCents || variant.costCents || getEstimatedCostCents(priceCents))
    const stockQty = Number(variant.stockQty || 0)
    const lowerLimitQty = Number(variant.lowerLimitQty || 0)
    const isLowStock = lowerLimitQty > 0 && stockQty <= lowerLimitQty

    return {
      ...variant,
      id: variant.id || `${product.id}-${index + 1}`,
      unit,
      priceCents,
      costPriceCents,
      stockQty,
      lowerLimitQty,
      imageUrl: getVariantImage(product, variant),
      warning: Boolean(variant.warning || isLowStock),
      stockTone: isLowStock ? 'danger' : 'normal',
      priceText: variant.priceText || (priceCents ? formatMoney(priceCents) : '未定价'),
      salePriceText: priceCents ? formatMoney(priceCents) : '未定价',
      costPriceText: costPriceCents ? formatMoney(costPriceCents) : '未录入',
      stockQtyText: formatNumber(stockQty),
      lowerLimitQtyText: formatNumber(lowerLimitQty),
      stockText: `${formatNumber(stockQty)}${unit}`,
      lowerLimitText: `${formatNumber(lowerLimitQty)}${unit}`
    }
  })
  const colorPreview = variants.map(variant => variant.color).filter(Boolean).slice(0, 4)
  const validPrices = variants.map(variant => variant.priceCents).filter(price => price > 0)
  const minPriceCents = validPrices.length ? Math.min(...validPrices) : 0
  const maxPriceCents = validPrices.length ? Math.max(...validPrices) : 0
  const totalStock = variants.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0)
  const warningCount = variants.filter(variant => variant.lowerLimitQty > 0 && variant.stockQty <= variant.lowerLimitQty).length
  const statusKey = warningCount ? 'warning' : (totalStock > 0 ? 'stocked' : 'empty')
  const statusText = warningCount ? '有预警' : (totalStock > 0 ? '有库存' : '无库存')
  const categoryPath = Array.isArray(product.categoryPath) && product.categoryPath.length ? product.categoryPath : inferCategoryPath(product)

  return {
    ...product,
    categoryPath,
    categoryPathText: categoryPath.join(' / '),
    categoryPathKeys: categoryPath.map((_, index) => categoryPath.slice(0, index + 1).join('/')),
    categoryLeaf: categoryPath[categoryPath.length - 1],
    imageUrl: getProductImage(product),
    coverText: getProductCoverText(product),
    enabledText: product.enabled === false ? '停用' : '启用',
    detailDescription: product.remark || '用于 AI 开单时优先带出该产品基础售价，颜色维度决定库存与价格。',
    variants,
    previewVariants: variants.slice(0, 4),
    colorCount: variants.length,
    colorPreview,
    minPriceCents,
    maxPriceCents,
    priceRangeText: getPriceRange({ minPriceCents, maxPriceCents }),
    totalStock,
    totalStockText: `${formatNumber(totalStock)}${product.unit || ''}`,
    warningCount,
    statusKey,
    statusText,
    statusTone: warningCount ? 'warning' : (totalStock > 0 ? 'success' : 'muted'),
    colorSummary: colorPreview.length ? colorPreview.join(' / ') : '默认',
    searchText: [
      product.name,
      product.no,
      product.category,
      categoryPath.join(' '),
      product.warehouse,
      product.unit,
      product.tag,
      colorPreview.join(' ')
    ].join(' ').toLowerCase()
  }
}

function loadProducts() {
  if (cachedProducts) return cachedProducts

  if (canUseStorage()) {
    const stored = wx.getStorageSync(productStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedProducts = stored.map(normalizeProduct)
      return cachedProducts
    }
  }

  cachedProducts = clone(productSeed).map(normalizeProduct)
  saveProducts()
  return cachedProducts
}

function saveProducts() {
  if (!canUseStorage()) return
  wx.setStorageSync(productStorageKey, cachedProducts)
}

function loadTasks() {
  if (cachedTasks) return cachedTasks

  if (canUseStorage()) {
    const stored = wx.getStorageSync(productTaskStorageKey)
    if (Array.isArray(stored)) {
      cachedTasks = stored
      return cachedTasks
    }
  }

  cachedTasks = []
  saveTasks()
  return cachedTasks
}

function saveTasks() {
  if (!canUseStorage()) return
  wx.setStorageSync(productTaskStorageKey, cachedTasks)
}

function buildCategoryRecordsFromProducts() {
  const nodeMap = {}
  loadProducts().forEach(product => {
    const path = product.categoryPath || inferCategoryPath(product)
    path.forEach((label, index) => {
      const key = path.slice(0, index + 1).join('/')
      if (!nodeMap[key]) {
        nodeMap[key] = {
          key,
          label,
          level: index + 1,
          parentKey: index === 0 ? '' : path.slice(0, index).join('/')
        }
      }
    })
  })
  return Object.values(nodeMap)
}

function saveCategoryRecords() {
  if (!canUseStorage()) return
  wx.setStorageSync(productCategoryStorageKey, cachedCategoryRecords)
}

function loadCategoryRecords() {
  if (cachedCategoryRecords) return cachedCategoryRecords

  if (canUseStorage()) {
    const stored = wx.getStorageSync(productCategoryStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedCategoryRecords = stored
      return cachedCategoryRecords
    }
  }

  cachedCategoryRecords = buildCategoryRecordsFromProducts()
  saveCategoryRecords()
  return cachedCategoryRecords
}

function getCategoryCountMap() {
  const countMap = {}
  loadProducts().forEach(product => {
    const path = product.categoryPath || inferCategoryPath(product)
    path.forEach((_, index) => {
      const key = path.slice(0, index + 1).join('/')
      countMap[key] = (countMap[key] || 0) + 1
    })
  })
  return countMap
}

function sortCategoryNodes(nodes) {
  return nodes.sort((a, b) => {
    const aParts = a.key.split('/')
    const bParts = b.key.split('/')
    for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
      const aPart = aParts[index] || ''
      const bPart = bParts[index] || ''
      if (aPart !== bPart) return aPart.localeCompare(bPart, 'zh-Hans-CN')
    }
    return a.level - b.level
  })
}

function syncCategoryRecords() {
  const records = loadCategoryRecords().slice()
  const existingKeys = records.map(record => record.key)
  let hasChanges = false

  buildCategoryRecordsFromProducts().forEach(record => {
    if (!existingKeys.includes(record.key)) {
      records.push(record)
      existingKeys.push(record.key)
      hasChanges = true
    }
  })

  if (hasChanges) {
    cachedCategoryRecords = sortCategoryNodes(records)
    saveCategoryRecords()
  }

  return cachedCategoryRecords || records
}

function getProductList() {
  return loadProducts()
}

function getProduct(id) {
  const decodedId = decodeURIComponent(id || '')
  return loadProducts().find(product => product.id === decodedId || product.no === decodedId) || loadProducts()[0]
}

function getCategories() {
  const categoryMap = {}
  loadProducts().forEach(product => {
    const key = product.category || '未分类'
    if (!categoryMap[key]) {
      categoryMap[key] = {
        id: encodeURIComponent(key).replace(/%/g, ''),
        name: key,
        productCount: 0,
        colorCount: 0,
        stockQty: 0,
        warningCount: 0
      }
    }
    categoryMap[key].productCount += 1
    categoryMap[key].colorCount += product.colorCount
    categoryMap[key].stockQty += product.totalStock
    categoryMap[key].warningCount += product.warningCount
  })

  return Object.keys(categoryMap)
    .map(key => ({
      ...categoryMap[key],
      stockText: formatNumber(categoryMap[key].stockQty)
    }))
    .sort((a, b) => b.productCount - a.productCount)
}

function getCategoryTree() {
  const records = syncCategoryRecords()
  const countMap = getCategoryCountMap()
  const groups = sortCategoryNodes(records.map(node => ({
    ...node,
    count: countMap[node.key] || 0,
    hasChildren: records.some(item => item.parentKey === node.key)
  })))

  return [{ key: '全部', label: '全部', level: 0, parentKey: '', count: loadProducts().length, hasChildren: true }].concat(groups)
}

function getCategoryForm(key) {
  const category = getCategoryTree().find(item => item.key === key)
  if (!category || category.key === '全部') {
    return {
      mode: 'create',
      key: '',
      label: '',
      parentKey: ''
    }
  }

  return {
    mode: 'edit',
    key: category.key,
    label: category.label,
    parentKey: category.parentKey || ''
  }
}

function getCategoryTemplateCsv() {
  return buildCsv(
    ['一级分类', '二级分类', '三级分类', '说明'],
    [
      {
        一级分类: '面料',
        二级分类: '绒布',
        三级分类: '水貂绒',
        说明: '示例行，正式导入前可删除'
      }
    ]
  )
}

function saveCategoryForm(form) {
  const label = String(form.label || '').trim()
  if (!label) return { ok: false, message: '请输入分类名称' }

  const records = syncCategoryRecords().slice()
  const oldKey = decodeURIComponent(form.key || '')
  const parentKey = String(form.parentKey || '').trim()
  const parent = parentKey ? records.find(record => record.key === parentKey) : null
  const level = parent ? parent.level + 1 : 1
  if (level > 3) return { ok: false, message: '最多支持三级分类' }

  const nextKey = parentKey ? `${parentKey}/${label}` : label
  const duplicate = records.find(record => record.key === nextKey && record.key !== oldKey)
  if (duplicate) return { ok: false, message: '该分类已存在' }

  if (!oldKey) {
    records.push({
      key: nextKey,
      label,
      parentKey,
      level
    })
    cachedCategoryRecords = sortCategoryNodes(records)
    saveCategoryRecords()
    return { ok: true, category: getCategoryForm(nextKey) }
  }

  const oldParts = oldKey.split('/')
  const nextParts = nextKey.split('/')
  const updatedRecords = records.map(record => {
    if (record.key !== oldKey && !record.key.startsWith(`${oldKey}/`)) return record
    const tail = record.key.split('/').slice(oldParts.length)
    const nextPath = nextParts.concat(tail)
    return {
      ...record,
      key: nextPath.join('/'),
      label: tail.length ? record.label : label,
      parentKey: nextPath.length === 1 ? '' : nextPath.slice(0, -1).join('/'),
      level: nextPath.length
    }
  })

  cachedProducts = loadProducts().map(product => {
    const path = product.categoryPath || inferCategoryPath(product)
    const pathKey = path.join('/')
    if (pathKey !== oldKey && !pathKey.startsWith(`${oldKey}/`)) return product
    const tail = path.slice(oldParts.length)
    const nextPath = nextParts.concat(tail)
    return normalizeProduct({
      ...product,
      category: nextPath[nextPath.length - 1],
      categoryPath: nextPath
    })
  })
  saveProducts()

  cachedCategoryRecords = sortCategoryNodes(updatedRecords)
  saveCategoryRecords()
  return { ok: true, category: getCategoryForm(nextKey) }
}

function getWarehouses() {
  return Array.from(new Set(loadProducts().map(product => product.warehouse).filter(Boolean)))
}

function getColorOptions() {
  const names = []
  loadProducts().forEach(product => {
    product.variants.forEach(variant => {
      if (variant.color && !names.includes(variant.color)) names.push(variant.color)
    })
  })
  return names.slice(0, 18)
}

function getProductSummary() {
  const products = loadProducts()
  const colorCount = products.reduce((sum, product) => sum + product.colorCount, 0)
  const warningCount = products.reduce((sum, product) => sum + product.warningCount, 0)
  return {
    productCount: products.length,
    colorCount,
    warningCount,
    categoryCount: getCategories().length
  }
}

function getProductForm(id) {
  const product = id ? getProduct(id) : null
  if (!product) {
    return {
      mode: 'create',
      id: '',
      name: '',
      no: '',
      imageUrl: productDefaultImage,
      category: '',
      warehouse: '贵阳仓库',
      unit: '米',
      remark: '',
      variants: [
        {
          id: 'new-1',
          color: '',
          unit: '米',
          unitIndex: 0,
          imageUrl: variantDefaultImage,
          stockQty: '',
          lowerLimitQty: '',
          price: '',
          costPrice: ''
        }
      ]
    }
  }

  return {
    mode: 'edit',
    id: product.id,
    name: product.name,
    no: product.no,
    imageUrl: product.imageUrl || productDefaultImage,
    category: product.category,
    warehouse: product.warehouse,
    unit: product.unit,
    remark: product.remark || '',
    variants: product.variants.map(variant => ({
      id: variant.id,
      color: variant.color,
      unit: variant.unit || product.unit || '件',
      imageUrl: variant.imageUrl || variantDefaultImage,
      stockQty: formatNumber(variant.stockQty),
      lowerLimitQty: formatNumber(variant.lowerLimitQty),
      price: formatAmountInput(variant.priceCents),
      costPrice: formatAmountInput(variant.costPriceCents)
    }))
  }
}

function saveProductForm(form) {
  const products = loadProducts()
  const name = String(form.name || '').trim()
  if (!name) return { ok: false, message: '请输入产品名称' }

  const oldId = decodeURIComponent(form.id || '')
  const no = String(form.no || '').trim() || `P${String(Date.now()).slice(-6)}`
  const variants = (form.variants || [])
    .filter(variant =>
      String(variant.color || '').trim() ||
      String(variant.price || '').trim() ||
      String(variant.costPrice || '').trim() ||
      String(variant.stockQty || '').trim() ||
      String(variant.lowerLimitQty || '').trim()
    )
    .map((variant, index) => ({
      id: variant.id || `${no}-${index + 1}`,
      color: String(variant.color || '默认').trim(),
      unit: String(variant.unit || form.unit || '件').trim(),
      imageUrl: variant.imageUrl || '',
      stockQty: Number(variant.stockQty || 0),
      lowerLimitQty: Number(variant.lowerLimitQty || 0),
      priceCents: parseAmountInput(variant.price),
      costPriceCents: parseAmountInput(variant.costPrice),
      swatch: variant.swatch || '#DDE6F0'
    }))

  const next = normalizeProduct({
    id: oldId || no,
    name,
    no,
    imageUrl: form.imageUrl || '',
    category: String(form.category || '未分类').trim(),
    warehouse: String(form.warehouse || '贵阳仓库').trim(),
    unit: String((variants[0] && variants[0].unit) || form.unit || '件').trim(),
    remark: String(form.remark || '').trim(),
    tag: '',
    variants: variants.length ? variants : [{ id: `${no}-1`, color: '默认', unit: form.unit || '件', imageUrl: variantDefaultImage, stockQty: 0, lowerLimitQty: 0, priceCents: 0, costPriceCents: 0, swatch: '#DDE6F0' }]
  })

  cachedProducts = products
    .filter(product => product.id !== oldId && product.no !== oldId && product.id !== next.id)
    .concat(next)
    .map(normalizeProduct)
  saveProducts()
  return { ok: true, product: next }
}

function updateVariantStock(productId, variantId, stockQty) {
  const decodedProductId = decodeURIComponent(productId || '')
  const decodedVariantId = decodeURIComponent(variantId || '')
  const products = loadProducts()
  let updatedProduct = null
  let updatedVariant = null

  cachedProducts = products.map(product => {
    if (product.id !== decodedProductId && product.no !== decodedProductId) return product

    const nextVariants = product.variants.map(variant => {
      if (variant.id !== decodedVariantId) return variant
      updatedVariant = {
        ...variant,
        stockQty: Number(stockQty || 0)
      }
      return updatedVariant
    })

    updatedProduct = normalizeProduct({
      ...product,
      variants: nextVariants
    })
    return updatedProduct
  })

  saveProducts()

  if (!updatedProduct || !updatedVariant) {
    return { ok: false, message: '库存记录不存在' }
  }

  return {
    ok: true,
    product: updatedProduct,
    variant: updatedProduct.variants.find(variant => variant.id === decodedVariantId)
  }
}

function escapeCsvValue(value) {
  const valueText = String(value === undefined || value === null ? '' : value)
  if (!/[",\n]/.test(valueText)) return valueText
  return `"${valueText.replace(/"/g, '""')}"`
}

function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')]
    .concat(rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(',')))
  return `\uFEFF${lines.join('\n')}`
}

function getProductTemplateCsv() {
  return buildCsv(
    ['名称', '产品编号', '产品分类', '仓库', '色号', '颜色', '期初库存', '库存下限', '单位', '售价', '备注'],
    [
      {
        名称: '示例产品',
        产品编号: 'P0001',
        产品分类: '法国绒',
        仓库: '贵阳仓库',
        色号: 'A01',
        颜色: '米色',
        期初库存: '0',
        库存下限: '0',
        单位: '米',
        售价: '0.00',
        备注: '示例行，正式导入前可删除'
      }
    ]
  )
}

function getProductExportCsv() {
  const rows = []
  loadProducts().forEach(product => {
    product.variants.forEach((variant, index) => {
      rows.push({
        名称: index === 0 ? product.name : '',
        产品编号: index === 0 ? product.no : '',
        产品分类: index === 0 ? product.category : '',
        仓库: index === 0 ? product.warehouse : '',
        色号: variant.colorNo || '',
        颜色: variant.color,
        期初库存: formatNumber(variant.stockQty),
        库存下限: formatNumber(variant.lowerLimitQty),
        单位: variant.unit || product.unit,
        售价: formatAmountInput(variant.priceCents),
        备注: index === 0 ? product.remark || '' : ''
      })
    })
  })
  return buildCsv(['名称', '产品编号', '产品分类', '仓库', '色号', '颜色', '期初库存', '库存下限', '单位', '售价', '备注'], rows)
}

function addProductTask(task) {
  const tasks = loadTasks()
  const next = {
    id: task.id || `PIET${Date.now()}`,
    time: task.time || formatDateTime(new Date()),
    title: task.title,
    desc: task.desc || '',
    statusText: task.statusText || '处理中',
    statusTone: task.statusTone || 'warning',
    filePath: task.filePath || '',
    fileName: task.fileName || '',
    fileSize: task.fileSize || 0,
    fileType: task.fileType || '',
    actionType: task.actionType || 'task'
  }

  cachedTasks = [next].concat(tasks).slice(0, 20)
  saveTasks()
  return next
}

function getProductTask(id) {
  return loadTasks().find(task => task.id === id)
}

function getProductImportExport() {
  return {
    importTitle: '产品批量导入',
    importDesc: '前端负责选择 Excel / CSV 文件并创建上传任务；接入后端后由接口接收文件、解析颜色子表并回写产品资料。',
    importHint: '当前不会在前端解析表格，任务会保留为待上传状态。',
    exportTitle: '产品批量导出',
    exportDesc: '按当前产品资料生成本地 CSV 文件；后续接入后端后替换为真实下载链接。',
    tasks: loadTasks()
  }
}

module.exports = {
  addProductTask,
  formatAmountInput,
  formatMoney,
  formatNumber,
  getCategories,
  getCategoryForm,
  getCategoryTemplateCsv,
  getCategoryTree,
  getColorOptions,
  getProduct,
  getProductExportCsv,
  getProductForm,
  getProductImportExport,
  getProductList,
  getProductSummary,
  getProductTask,
  getProductTemplateCsv,
  getProductDefaultImage,
  getVariantDefaultImage,
  getWarehouses,
  saveProductForm,
  saveCategoryForm,
  updateVariantStock
}
