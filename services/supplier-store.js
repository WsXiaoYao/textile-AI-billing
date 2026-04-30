const productStore = require('./product-store')

const supplierStorageKey = 'textile_suppliers_v1'

let cachedSuppliers

const supplierSeed = [
  {
    id: 'S001',
    name: '贵阳的织树料厂',
    phone: '18334047304',
    address: '贵阳白云区货物园区 2 栋',
    remark: '采购主供应商，常供辅料与寸布面料。',
    statusKey: 'enabled',
    isCommon: true,
    purchaseRecords: [
      {
        no: 'CG202604180003',
        date: '2026-04-18',
        productName: '投色仓',
        color: '合同',
        quantityText: '2匹',
        unitPriceCents: 430000,
        amountCents: 860000
      },
      {
        no: 'CG202604120001',
        date: '2026-04-12',
        productName: '默认仓',
        color: '合同',
        quantityText: '1匹',
        unitPriceCents: 520000,
        amountCents: 520000
      },
      {
        no: 'CG202604050002',
        date: '2026-04-05',
        productName: '辅料仓',
        color: '合同',
        quantityText: '1批',
        unitPriceCents: 480000,
        amountCents: 480000
      }
    ]
  },
  {
    id: 'S002',
    name: '浙江双雄布业',
    phone: '15185242522',
    address: '杭州柯桥区',
    remark: '主营绒布和复合面料。',
    statusKey: 'enabled',
    isCommon: true,
    purchaseRecords: [
      {
        no: 'CG202604100001',
        date: '2026-04-10',
        productName: '水貂绒',
        color: '灰色',
        quantityText: '3匹',
        unitPriceCents: 214000,
        amountCents: 642000
      }
    ]
  },
  {
    id: 'S003',
    name: '海绵辅料仓',
    phone: '15685216085',
    address: '花溪产业园',
    remark: '海绵、胶膜和包装辅料。',
    statusKey: 'enabled',
    isCommon: false,
    purchaseRecords: [
      {
        no: 'CG202604080001',
        date: '2026-04-08',
        productName: '海绵',
        color: '5公分',
        quantityText: '45张',
        unitPriceCents: 9000,
        amountCents: 405000
      }
    ]
  },
  {
    id: 'S004',
    name: '织锦辅料供应',
    phone: '18060001122',
    address: '金阳大道',
    remark: '织带、拉链和小五金供应。',
    statusKey: 'enabled',
    isCommon: false,
    purchaseRecords: [
      {
        no: 'CG202604020001',
        date: '2026-04-02',
        productName: '金线织带',
        color: '默认',
        quantityText: '20条',
        unitPriceCents: 11800,
        amountCents: 236000
      }
    ]
  }
]

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeRecord(record) {
  const amountCents = Number(record.amountCents || 0)
  return {
    ...record,
    no: String(record.no || '').trim(),
    date: record.date || '',
    productName: String(record.productName || '未命名品项').trim(),
    color: String(record.color || '默认').trim(),
    quantityText: record.quantityText || '',
    unitPriceCents: Number(record.unitPriceCents || 0),
    unitPriceText: productStore.formatMoney(record.unitPriceCents || 0),
    amountCents,
    amountText: productStore.formatMoney(amountCents)
  }
}

function normalizeSupplier(supplier) {
  const purchaseRecords = (supplier.purchaseRecords || []).map(normalizeRecord)
  const totalPurchaseCents = purchaseRecords.reduce((sum, record) => sum + record.amountCents, 0)
  const statusKey = supplier.statusKey === 'disabled' ? 'disabled' : 'enabled'
  const lastRecord = purchaseRecords[0]

  return {
    ...supplier,
    id: supplier.id || `SUP${Date.now()}`,
    name: String(supplier.name || '未命名供应商').trim(),
    phone: String(supplier.phone || '').trim(),
    address: String(supplier.address || '').trim(),
    remark: String(supplier.remark || '').trim(),
    statusKey,
    statusText: statusKey === 'enabled' ? '启用' : '停用',
    statusTone: statusKey === 'enabled' ? 'success' : 'muted',
    isCommon: Boolean(supplier.isCommon),
    purchaseRecords,
    purchaseCount: purchaseRecords.length,
    totalPurchaseCents,
    totalPurchaseText: productStore.formatMoney(totalPurchaseCents),
    latestDate: lastRecord ? lastRecord.date : '',
    latestText: lastRecord ? `${lastRecord.date} · ${lastRecord.productName}` : '暂无采购记录',
    searchText: [
      supplier.name,
      supplier.phone,
      supplier.address,
      supplier.remark,
      statusKey
    ].join(' ').toLowerCase()
  }
}

function saveSuppliers() {
  if (!canUseStorage()) return
  wx.setStorageSync(supplierStorageKey, cachedSuppliers)
}

function loadSuppliers() {
  if (cachedSuppliers) return cachedSuppliers

  if (canUseStorage()) {
    const stored = wx.getStorageSync(supplierStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedSuppliers = stored.map(normalizeSupplier)
      return cachedSuppliers
    }
  }

  cachedSuppliers = clone(supplierSeed).map(normalizeSupplier)
  saveSuppliers()
  return cachedSuppliers
}

function sortSuppliers(list) {
  return list.slice().sort((a, b) => {
    if (b.totalPurchaseCents !== a.totalPurchaseCents) return b.totalPurchaseCents - a.totalPurchaseCents
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
}

function getSupplierList() {
  return sortSuppliers(loadSuppliers())
}

function getSupplier(id) {
  const decodedId = decodeURIComponent(id || '')
  return loadSuppliers().find(supplier => supplier.id === decodedId) || loadSuppliers()[0]
}

function getSupplierForm(id) {
  const supplier = id ? getSupplier(id) : null
  if (!supplier) {
    return {
      mode: 'create',
      id: '',
      name: '',
      phone: '',
      address: '',
      remark: '',
      statusKey: 'enabled',
      isCommon: false
    }
  }

  return {
    mode: 'edit',
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    address: supplier.address,
    remark: supplier.remark,
    statusKey: supplier.statusKey,
    isCommon: supplier.isCommon
  }
}

function saveSupplierForm(form) {
  const name = String(form.name || '').trim()
  if (!name) return { ok: false, message: '请输入供应商名称' }

  const oldId = decodeURIComponent(form.id || '')
  const suppliers = loadSuppliers()
  const duplicate = suppliers.find(supplier => supplier.name === name && supplier.id !== oldId)
  if (duplicate) return { ok: false, message: '供应商名称已存在' }

  const previous = oldId ? getSupplier(oldId) : null
  const next = normalizeSupplier({
    id: oldId || `SUP${Date.now()}`,
    name,
    phone: form.phone,
    address: form.address,
    remark: form.remark,
    statusKey: form.statusKey,
    isCommon: Boolean(form.isCommon),
    purchaseRecords: previous ? previous.purchaseRecords : []
  })

  cachedSuppliers = suppliers
    .filter(supplier => supplier.id !== oldId)
    .concat(next)
    .map(normalizeSupplier)
  saveSuppliers()

  return { ok: true, supplier: next }
}

function toggleSupplierStatus(id) {
  const supplier = getSupplier(id)
  if (!supplier) return { ok: false, message: '供应商不存在' }

  cachedSuppliers = loadSuppliers().map(item => {
    if (item.id !== supplier.id) return item
    return normalizeSupplier({
      ...item,
      statusKey: item.statusKey === 'enabled' ? 'disabled' : 'enabled'
    })
  })
  saveSuppliers()
  return { ok: true, supplier: getSupplier(id) }
}

module.exports = {
  getSupplier,
  getSupplierForm,
  getSupplierList,
  saveSupplierForm,
  toggleSupplierStatus
}
