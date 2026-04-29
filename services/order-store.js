const storageKey = 'textile_order_store_v1'
const customerFundStorageKey = 'textile_customer_funds_v2'
const customerProfileStorageKey = 'textile_customer_profiles_v2'
const customerImportTaskStorageKey = 'textile_customer_import_export_tasks_v2'
const realCustomerSeed = require('../data/customer-seed')

const today = '2026-04-28'

const seedCustomerFunds = []

const customerMeta = {
  '黔西-龙凤': {
    code: 'TC-001',
    tag: '贵州客户',
    category: '贵州客户',
    area: '贵州',
    level: 'key'
  },
  测试客户: {
    code: 'TC-002',
    tag: '零售客户',
    category: '零售客户',
    area: '贵州',
    level: 'normal'
  },
  '四川古蔺-王端': {
    code: 'TC-003',
    tag: '四川客户',
    category: '外地客户',
    area: '四川',
    level: 'key'
  },
  贵阳李总: {
    code: 'TC-004',
    tag: '老客户',
    category: '贵州客户',
    area: '贵州',
    level: 'key'
  },
  赫章杨兰物流: {
    code: 'TC-005',
    tag: '物流客户',
    category: '物流客户',
    area: '贵州',
    level: 'key'
  },
  '金沙布行-陈姐': {
    code: 'TC-006',
    tag: '布行客户',
    category: '批发客户',
    area: '贵州',
    level: 'normal'
  }
}

const paymentMeta = {
  unpaid: { text: '未收款', tone: 'danger', amountTone: 'danger' },
  partial: { text: '部分收款', tone: 'warning', amountTone: 'danger' },
  paid: { text: '已收款', tone: 'success', amountTone: 'success' },
  overpaid: { text: '超收款', tone: 'primary', amountTone: 'primary' },
  prepaid: { text: '计入预收', tone: 'primary', amountTone: 'success' },
  refunded: { text: '已退款', tone: 'muted', amountTone: 'muted' }
}

const deliveryMeta = {
  unshipped: { text: '未送货', tone: 'muted' },
  partial: { text: '部分送货', tone: 'warning' },
  delivered: { text: '全部送货', tone: 'success' },
  overdelivered: { text: '超送货', tone: 'primary' },
  refused: { text: '拒收', tone: 'danger' }
}

const printMeta = {
  unprinted: { text: '未打印', tone: 'danger' },
  printed: { text: '已打印', tone: 'success' }
}

const seedOrders = [
  {
    id: 'XS202604180003',
    no: 'XS202604180003',
    customer: {
      name: '黔西-龙凤',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '25玛寸布 2条明细',
    saleDate: '2026-04-18',
    warehouse: '默认仓',
    creator: '王姐',
    paymentState: 'partial',
    deliveryState: 'partial',
    printState: 'unprinted',
    orderCents: 47250,
    discountCents: 7250,
    contractCents: 40000,
    receivedCents: 8000,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '25玛寸布', color: '米色', qty: '20米', priceCents: 150, amountCents: 3000 },
      { id: 'p2', name: '25玛寸布', color: '深灰', qty: '15米', priceCents: 150, amountCents: 2250 },
      { id: 'p3', name: '280祥云', color: 'H513-米', qty: '10米', priceCents: 4200, amountCents: 42000 }
    ],
    receiptRecords: [
      {
        no: 'R202604180001',
        type: '线下收款',
        amountCents: 8000,
        date: '2026-04-18',
        rule: '补录本单线下收款，已回写客户往来。'
      }
    ]
  },
  {
    id: 'XS202604220006',
    no: 'XS202604220006',
    customer: {
      name: '黔西-龙凤',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '280祥云 2条明细',
    saleDate: '2026-04-22',
    warehouse: '默认仓',
    creator: '涛',
    paymentState: 'unpaid',
    deliveryState: 'unshipped',
    printState: 'unprinted',
    orderCents: 68000,
    discountCents: 0,
    contractCents: 68000,
    receivedCents: 0,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '280祥云', color: 'H513-米', qty: '8米', priceCents: 4200, amountCents: 33600 },
      { id: 'p2', name: '280祥云', color: 'H513-灰', qty: '8米', priceCents: 4300, amountCents: 34400 }
    ],
    receiptRecords: []
  },
  {
    id: 'XS202604150004',
    no: 'XS202604150004',
    customer: {
      name: '黔西-龙凤',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '25玛寸布 1条明细',
    saleDate: '2026-04-15',
    warehouse: '默认仓',
    creator: '王姐',
    paymentState: 'partial',
    deliveryState: 'delivered',
    printState: 'printed',
    orderCents: 21000,
    discountCents: 0,
    contractCents: 21000,
    receivedCents: 9000,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '25玛寸布', color: '深灰', qty: '14米', priceCents: 1500, amountCents: 21000 }
    ],
    receiptRecords: [
      {
        no: 'R202604150001',
        type: '线下收款',
        amountCents: 9000,
        date: '2026-04-15',
        rule: '本单已先收部分货款。'
      }
    ]
  },
  {
    id: 'XS202604210002',
    no: 'XS202604210002',
    customer: {
      name: '测试客户',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '棉布 1条明细',
    saleDate: '2026-04-21',
    warehouse: '默认仓',
    creator: '涛',
    paymentState: 'overpaid',
    deliveryState: 'unshipped',
    printState: 'unprinted',
    orderCents: 100,
    discountCents: 0,
    contractCents: 100,
    receivedCents: 200,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '棉布', color: '默认', qty: '1米', priceCents: 100, amountCents: 100 }
    ],
    receiptRecords: [
      {
        no: 'R202604210002',
        type: '超收款',
        amountCents: 200,
        date: '2026-04-21',
        rule: '超出合同金额的部分计入客户往来。'
      }
    ]
  },
  {
    id: 'XS202604160001',
    no: 'XS202604160001',
    customer: {
      name: '四川古蔺-王端',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '280祥云 1条明细',
    saleDate: '2026-04-16',
    warehouse: '默认仓',
    creator: '邓',
    paymentState: 'unpaid',
    deliveryState: 'unshipped',
    printState: 'printed',
    orderCents: 157500,
    discountCents: 0,
    contractCents: 157500,
    receivedCents: 0,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '280祥云', color: '默认', qty: '1条', priceCents: 157500, amountCents: 157500 }
    ],
    receiptRecords: []
  },
  {
    id: 'XS202604130001',
    no: 'XS202604130001',
    customer: {
      name: '贵阳李总',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '3公分金线曲牙织带',
    saleDate: '2026-04-13',
    warehouse: '默认仓',
    creator: '航',
    paymentState: 'paid',
    deliveryState: 'delivered',
    printState: 'printed',
    orderCents: 42000,
    discountCents: 0,
    contractCents: 42000,
    receivedCents: 42000,
    refundCents: 0,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '3公分金线曲牙织带', color: '默认', qty: '10米', priceCents: 4200, amountCents: 42000 }
    ],
    receiptRecords: [
      {
        no: 'R202604130001',
        type: '已收款',
        amountCents: 42000,
        date: '2026-04-13',
        rule: '收款已回写客户资金往来。'
      }
    ]
  },
  {
    id: 'XS202604120001',
    no: 'XS202604120001',
    customer: {
      name: '赫章杨兰物流',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '25玛寸布 3条明细',
    saleDate: '2026-04-12',
    warehouse: '默认仓',
    creator: '旺',
    paymentState: 'prepaid',
    deliveryState: 'overdelivered',
    printState: 'unprinted',
    orderCents: 60000,
    discountCents: 0,
    contractCents: 60000,
    receivedCents: 60000,
    refundCents: 0,
    prepaidBalanceCents: 60000,
    products: [
      { id: 'p1', name: '25玛寸布', color: '米白', qty: '20米', priceCents: 1000, amountCents: 20000 },
      { id: 'p2', name: '25玛寸布', color: '深灰', qty: '20米', priceCents: 1000, amountCents: 20000 },
      { id: 'p3', name: '280祥云', color: 'H513-米', qty: '5米', priceCents: 4000, amountCents: 20000 }
    ],
    receiptRecords: [
      {
        no: 'R202604120001',
        type: '计入预收',
        amountCents: 60000,
        date: '2026-04-12',
        rule: '收款进入客户预收账户，后续开单可自动冲抵。'
      }
    ]
  },
  {
    id: 'XS202604110001',
    no: 'XS202604110001',
    customer: {
      name: '金沙布行-陈姐',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道'
    },
    goodsSummary: '窗帘布 2条明细',
    saleDate: '2026-04-11',
    warehouse: '默认仓',
    creator: '王姐',
    paymentState: 'refunded',
    deliveryState: 'refused',
    printState: 'printed',
    orderCents: 86000,
    discountCents: 0,
    contractCents: 86000,
    receivedCents: 86000,
    refundCents: 86000,
    prepaidBalanceCents: 0,
    products: [
      { id: 'p1', name: '窗帘布', color: '浅灰', qty: '12米', priceCents: 4500, amountCents: 54000 },
      { id: 'p2', name: '遮光布', color: '蓝灰', qty: '8米', priceCents: 4000, amountCents: 32000 }
    ],
    receiptRecords: [
      {
        no: 'RF202604110001',
        type: '已退款',
        amountCents: -86000,
        date: '2026-04-11',
        rule: '退款已回写客户资金往来。'
      }
    ]
  }
]

let cachedOrders
let cachedCustomerFunds
let cachedCustomerProfiles
let cachedCustomerImportTasks

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function mergeSeedOrders(orders) {
  const existingIds = orders.map(order => order.id)
  const missingSeeds = seedOrders.filter(order => !existingIds.includes(order.id))
  if (!missingSeeds.length) return orders
  return orders.concat(clone(missingSeeds))
}

function loadOrders() {
  if (cachedOrders) return cachedOrders

  if (canUseStorage()) {
    const stored = wx.getStorageSync(storageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedOrders = mergeSeedOrders(stored)
      if (cachedOrders.length !== stored.length) saveOrders()
      return cachedOrders
    }
  }

  cachedOrders = clone(seedOrders)
  saveOrders()
  return cachedOrders
}

function saveOrders() {
  if (!canUseStorage()) return
  wx.setStorageSync(storageKey, cachedOrders)
}

function mergeSeedCustomerFunds(funds) {
  const existingIds = funds.map(record => record.id)
  const missingSeeds = seedCustomerFunds.filter(record => !existingIds.includes(record.id))
  if (!missingSeeds.length) return funds
  return funds.concat(clone(missingSeeds))
}

function loadCustomerFunds() {
  if (cachedCustomerFunds) return cachedCustomerFunds

  if (canUseStorage()) {
    const stored = wx.getStorageSync(customerFundStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedCustomerFunds = mergeSeedCustomerFunds(stored)
      if (cachedCustomerFunds.length !== stored.length) saveCustomerFunds()
      return cachedCustomerFunds
    }
  }

  cachedCustomerFunds = clone(seedCustomerFunds)
  saveCustomerFunds()
  return cachedCustomerFunds
}

function saveCustomerFunds() {
  if (!canUseStorage()) return
  wx.setStorageSync(customerFundStorageKey, cachedCustomerFunds)
}

function loadCustomerProfiles() {
  if (cachedCustomerProfiles) return cachedCustomerProfiles

  if (canUseStorage()) {
    const stored = wx.getStorageSync(customerProfileStorageKey)
    if (Array.isArray(stored)) {
      cachedCustomerProfiles = stored
      return cachedCustomerProfiles
    }
  }

  cachedCustomerProfiles = []
  saveCustomerProfiles()
  return cachedCustomerProfiles
}

function saveCustomerProfiles() {
  if (!canUseStorage()) return
  wx.setStorageSync(customerProfileStorageKey, cachedCustomerProfiles)
}

function loadCustomerImportTasks() {
  if (cachedCustomerImportTasks) return cachedCustomerImportTasks

  if (canUseStorage()) {
    const stored = wx.getStorageSync(customerImportTaskStorageKey)
    if (Array.isArray(stored)) {
      cachedCustomerImportTasks = stored
      return cachedCustomerImportTasks
    }
  }

  cachedCustomerImportTasks = []
  saveCustomerImportTasks()
  return cachedCustomerImportTasks
}

function saveCustomerImportTasks() {
  if (!canUseStorage()) return
  wx.setStorageSync(customerImportTaskStorageKey, cachedCustomerImportTasks)
}

function formatDateTime(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addCustomerImportTask(task) {
  const tasks = loadCustomerImportTasks()
  const next = {
    id: task.id || `CIET${Date.now()}`,
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

  cachedCustomerImportTasks = [next].concat(tasks).slice(0, 20)
  saveCustomerImportTasks()
  return next
}

function updateCustomerImportTask(id, patch) {
  const tasks = loadCustomerImportTasks()
  cachedCustomerImportTasks = tasks.map(task => (
    task.id === id
      ? {
          ...task,
          ...patch,
          updatedAt: formatDateTime(new Date())
        }
      : task
  ))
  saveCustomerImportTasks()
  return cachedCustomerImportTasks.find(task => task.id === id)
}

function getCustomerImportTask(id) {
  return loadCustomerImportTasks().find(task => task.id === id)
}

function getCustomerProfile(name) {
  const decodedName = decodeURIComponent(name || '')
  return loadCustomerProfiles().find(profile => profile.id === decodedName || profile.name === decodedName)
}

function getCustomerFundRecords(customerName) {
  return loadCustomerFunds().filter(record => record.customerName === customerName)
}

function getCustomerFundBalance(customerName) {
  return getCustomerFundRecords(customerName).reduce((sum, record) => sum + Number(record.amountCents || 0), 0)
}

function appendCustomerFund(record) {
  const funds = loadCustomerFunds()
  funds.push({
    id: record.id || `CF${String(Date.now()).slice(-10)}${funds.length}`,
    customerName: record.customerName,
    type: record.type,
    typeText: record.typeText,
    amountCents: Number(record.amountCents || 0),
    date: record.date || today,
    rule: record.rule || '',
    remark: record.remark || ''
  })
  cachedCustomerFunds = funds
  saveCustomerFunds()
}

function formatMoney(cents, options = {}) {
  const absCents = Math.abs(cents)
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const yuanText = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimalText = fen ? `.${String(fen).padStart(2, '0')}` : ''
  const sign = cents < 0 ? '-' : ''
  const prefix = options.plus && cents > 0 ? '+' : ''
  return `${prefix}${sign}¥${yuanText}${decimalText}`
}

function formatCompactMoney(cents) {
  const sign = cents < 0 ? '-' : ''
  const absYuan = Math.abs(cents) / 100

  if (absYuan >= 10000) {
    const value = (absYuan / 10000)
      .toFixed(absYuan >= 1000000 ? 1 : 2)
      .replace(/\.0+$/, '')
      .replace(/(\.\d)0$/, '$1')
    return `${sign}¥${value}万`
  }

  return formatMoney(cents)
}

function formatAmountInput(cents) {
  return (cents / 100).toFixed(2)
}

function parseAmountInput(value) {
  const normalized = String(value || '').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const parts = normalized.split('.')
  const yuan = Number(parts[0] || 0)
  const fenText = String(parts[1] || '').slice(0, 2).padEnd(2, '0')
  const fen = Number(fenText || 0)
  if (Number.isNaN(yuan) || Number.isNaN(fen)) return 0
  return yuan * 100 + fen
}

function getUnpaidCents(order) {
  if (order.paymentState === 'refunded') return 0
  return Math.max(order.contractCents - order.receivedCents, 0)
}

function getOverpaidCents(order) {
  if (order.paymentState === 'refunded') return 0
  return Math.max(order.receivedCents - order.contractCents, 0)
}

function getPaymentState(order) {
  if (order.refundCents > 0) return 'refunded'
  if (order.prepaidBalanceCents > 0) return 'prepaid'
  if (getOverpaidCents(order) > 0) return 'overpaid'
  if (getUnpaidCents(order) === 0) return 'paid'
  if (order.receivedCents > 0) return 'partial'
  return 'unpaid'
}

function normalizeOrder(order) {
  const paymentState = getPaymentState(order)
  return {
    ...order,
    paymentState
  }
}

function findOrder(id) {
  const orders = loadOrders()
  return orders.find(order => order.id === id) || orders[0]
}

function getReceiptAmountText(order) {
  if (order.paymentState === 'refunded') return formatMoney(-order.refundCents)
  if (getOverpaidCents(order) > 0) return formatMoney(getOverpaidCents(order), { plus: true })
  return formatMoney(getUnpaidCents(order))
}

function getListOrder(order) {
  const normalized = normalizeOrder(order)
  const payment = paymentMeta[normalized.paymentState] || paymentMeta.unpaid
  const delivery = deliveryMeta[normalized.deliveryState] || deliveryMeta.unshipped
  const print = printMeta[normalized.printState] || printMeta.unprinted

  return {
    id: normalized.id,
    no: normalized.no,
    customer: normalized.customer.name,
    goodsSummary: normalized.goodsSummary,
    saleDate: normalized.saleDate,
    statusText: payment.text,
    statusTone: payment.tone,
    receivableText: getReceiptAmountText(normalized),
    amountTone: payment.amountTone,
    receivableCents: getUnpaidCents(normalized) || -getOverpaidCents(normalized),
    creator: normalized.creator,
    paymentState: normalized.paymentState,
    deliveryState: normalized.deliveryState,
    deliveryText: delivery.text,
    printState: normalized.printState,
    printText: print.text,
    isDraft: false,
    chips: [
      { text: delivery.text, tone: delivery.tone },
      { text: print.text, tone: print.tone },
      { text: `制单人 ${normalized.creator}`, tone: 'muted' }
    ]
  }
}

function getOrderList() {
  return loadOrders().map(order => getListOrder(order))
}

function getOrderSummary() {
  const orders = loadOrders().map(order => normalizeOrder(order))
  const unpaidCents = orders.reduce((sum, order) => sum + getUnpaidCents(order), 0)
  const specialCount = orders.filter(order => ['overpaid', 'prepaid', 'refunded'].includes(order.paymentState)).length
  const closedCount = orders.filter(order => order.paymentState === 'paid').length

  return {
    title: '订单概览',
    metrics: [
      { key: 'unreceived', label: '未收金额', value: formatMoney(unpaidCents), tone: 'danger' },
      { key: 'special', label: '特殊状态', value: `${specialCount}单`, tone: 'primary' },
      { key: 'closed', label: '已结清', value: `${closedCount}单`, tone: 'success' }
    ]
  }
}

function getCustomerMeta(name, index, base = {}) {
  const profile = getCustomerProfile(name)
  const meta = {
    ...base,
    ...(customerMeta[name] || {}),
    ...(profile || {})
  }
  return {
    code: meta.code || `TC-${String(index + 1).padStart(3, '0')}`,
    tag: meta.tag || meta.category || '普通客户',
    category: meta.category || '普通客户',
    area: meta.area || '未分区',
    level: meta.level || 'normal'
  }
}

function getCustomerStatus(customer) {
  if (customer.receivableCents > 0) {
    return {
      statusKey: 'receivable',
      statusText: '有欠款',
      statusTone: 'danger',
      balanceLabel: '累计欠款',
      balanceText: formatMoney(customer.receivableCents),
      balanceTone: 'danger'
    }
  }

  if (customer.prepaidCents > 0) {
    return {
      statusKey: 'prepaid',
      statusText: '有预收',
      statusTone: 'primary',
      balanceLabel: '预收余额',
      balanceText: formatMoney(customer.prepaidCents),
      balanceTone: 'primary'
    }
  }

  return {
    statusKey: 'settled',
    statusText: '已结清',
    statusTone: 'success',
    balanceLabel: '当前欠款',
    balanceText: formatMoney(0),
    balanceTone: 'success'
  }
}

function getCustomerList() {
  const customerMap = {}

  realCustomerSeed.forEach(seed => {
    customerMap[seed.name] = {
      id: seed.name,
      name: seed.name,
      phone: seed.phone || '',
      address: seed.address || '',
      category: seed.category || '普通客户',
      tag: seed.tag || seed.category || '普通客户',
      area: seed.area || '未分区',
      level: seed.level || 'normal',
      remark: seed.remark || '',
      source: 'real-customer-list',
      orderCount: 0,
      contractCents: Number(seed.contractCents || 0),
      receivedCents: Number(seed.receivedCents || 0),
      receivableCents: Number(seed.receivableCents || 0),
      prepaidCents: Number(seed.prepaidCents || 0),
      lastOrderDate: '',
      lastOrderNo: '',
      recentGoods: '',
      creators: []
    }
  })

  loadCustomerProfiles().forEach(profile => {
    const openingReceivableCents = Number(profile.openingReceivableCents || 0)
    const existing = customerMap[profile.name]

    if (existing) {
      customerMap[profile.name] = {
        ...existing,
        phone: profile.phone || existing.phone,
        address: profile.address || existing.address,
        category: profile.category || existing.category,
        tag: profile.tag || profile.category || existing.tag,
        area: profile.area || existing.area,
        level: profile.level || existing.level,
        remark: profile.remark || existing.remark,
        profileUpdatedAt: profile.updatedAt || ''
      }
      return
    }

    customerMap[profile.name] = {
      id: profile.name,
      name: profile.name,
      phone: profile.phone || '',
      address: profile.address || '',
      category: profile.category || '普通客户',
      tag: profile.tag || profile.category || '普通客户',
      area: profile.area || '未分区',
      level: profile.level || 'normal',
      remark: profile.remark || '',
      source: 'manual-profile',
      orderCount: 0,
      contractCents: openingReceivableCents,
      receivedCents: 0,
      receivableCents: openingReceivableCents,
      prepaidCents: 0,
      lastOrderDate: profile.updatedAt || today,
      lastOrderNo: '',
      recentGoods: '',
      creators: []
    }
  })

  loadOrders().map(order => normalizeOrder(order)).forEach(order => {
    const name = order.customer.name
    if (!customerMap[name]) return

    const customer = customerMap[name]
    if (customer.source === 'real-customer-list') return

    const overpaidCents = getOverpaidCents(order)
    const unpaidCents = getUnpaidCents(order)
    customer.orderCount += 1
    customer.contractCents += order.contractCents
    customer.receivedCents += order.receivedCents
    customer.receivableCents += unpaidCents
    customer.prepaidCents += overpaidCents + order.prepaidBalanceCents

    if (!customer.creators.includes(order.creator)) {
      customer.creators.push(order.creator)
    }

    if (!customer.lastOrderDate || order.saleDate > customer.lastOrderDate) {
      customer.lastOrderDate = order.saleDate
      customer.lastOrderNo = order.no
      customer.recentGoods = order.goodsSummary
    }
  })

  return Object.keys(customerMap).map((name, index) => {
    const profile = getCustomerProfile(name)
    const customer = {
      ...customerMap[name],
      phone: profile && profile.phone ? profile.phone : customerMap[name].phone,
      address: profile && profile.address ? profile.address : customerMap[name].address,
      prepaidCents: Math.max(customerMap[name].prepaidCents + getCustomerFundBalance(name), 0)
    }
    const meta = getCustomerMeta(name, index, {
      category: customer.category,
      tag: customer.tag,
      area: customer.area,
      level: customer.level
    })
    const status = getCustomerStatus(customer)
    const chips = [
      { text: meta.category, tone: 'primary' }
    ]

    if (customer.orderCount > 0) {
      chips.push({ text: `${customer.orderCount}单`, tone: 'muted' })
    }

    chips.push({ text: meta.area, tone: 'info' })

    if (meta.level === 'key') {
      chips.push({ text: '重点客户', tone: 'warning' })
    }

    return {
      ...customer,
      ...meta,
      ...status,
      activeState: customer.lastOrderDate >= '2026-04-01' ? 'active' : 'silent',
      contractText: formatMoney(customer.contractCents),
      receivedText: formatMoney(customer.receivedCents),
      receivableText: formatMoney(customer.receivableCents),
      prepaidText: formatMoney(customer.prepaidCents),
      creatorsText: customer.creators.join('、'),
      remark: profile ? profile.remark || customer.remark || '' : customer.remark || '',
      openingReceivableCents: profile ? Number(profile.openingReceivableCents || 0) : 0,
      chips
    }
  })
}

function getCustomerForm(id) {
  const customerId = decodeURIComponent(id || '')
  const customer = getCustomerList().find(item => item.id === customerId)
  const profile = getCustomerProfile(customerId)

  if (!customer && !profile) {
    return {
      mode: 'create',
      id: '',
      name: '',
      phone: '',
      category: '',
      address: '',
      openingReceivable: '',
      remark: ''
    }
  }

  const source = {
    ...(customer || {}),
    ...(profile || {})
  }

  return {
    mode: 'edit',
    id: source.id || source.name,
    name: source.name || '',
    phone: source.phone || '',
    category: source.category || source.tag || '',
    address: source.address || '',
    openingReceivable: source.openingReceivableCents ? formatAmountInput(Number(source.openingReceivableCents)) : '',
    remark: source.remark || ''
  }
}

function inferArea(category, fallback) {
  if (category && category.includes('贵州')) return '贵州'
  if (category && category.includes('四川')) return '四川'
  if (category && category.includes('物流')) return '贵州'
  return fallback || '未分区'
}

function saveCustomerProfile(profile) {
  const currentProfiles = loadCustomerProfiles()
  const oldId = decodeURIComponent(profile.id || '')
  const name = String(profile.name || '').trim()
  if (!name) {
    return {
      ok: false,
      message: '请输入客户名称'
    }
  }

  const existing = getCustomerProfile(oldId || name) || getCustomerProfile(name) || {}
  const staticMeta = customerMeta[oldId] || customerMeta[name] || {}
  const category = String(profile.category || existing.category || staticMeta.category || '普通客户').trim()
  const next = {
    id: name,
    name,
    phone: String(profile.phone || existing.phone || '').trim(),
    address: String(profile.address || existing.address || '').trim(),
    category,
    tag: category,
    area: inferArea(category, existing.area || staticMeta.area),
    level: existing.level || staticMeta.level || 'normal',
    openingReceivableCents: parseAmountInput(profile.openingReceivable),
    remark: String(profile.remark || '').trim(),
    updatedAt: today
  }

  cachedCustomerProfiles = currentProfiles
    .filter(item => item.id !== oldId && item.name !== oldId && item.id !== name && item.name !== name)
    .concat(next)
  saveCustomerProfiles()

  return {
    ok: true,
    customer: getCustomerForm(name)
  }
}

function escapeCsvValue(value) {
  const text = String(value === undefined || value === null ? '' : value)
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function buildCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvValue).join(',')
  ].concat(rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(',')))
  return `\uFEFF${lines.join('\n')}`
}

function getCustomerTemplateCsv() {
  return buildCsv(
    ['客户分类', '客户名称', '电话', '合同金额', '已送货', '预收款', '未收款', '已收款', '备注', '详细地址'],
    [
      {
        客户分类: '贵州客户',
        客户名称: '示例客户',
        电话: '13800000000',
        合同金额: '0.00',
        已送货: '0.00',
        预收款: '0.00',
        未收款: '0.00',
        已收款: '0.00',
        备注: '示例行，正式导入前可删除',
        详细地址: '贵州省毕节市黔西市'
      }
    ]
  )
}

function getCustomerExportCsv(type) {
  const customers = getCustomerList()
  const rows = customers.map(customer => ({
    客户名称: customer.name,
    客户编码: customer.code,
    联系电话: customer.phone,
    客户分类: customer.category,
    客户区域: customer.area,
    详细地址: customer.address,
    合同金额: customer.contractText,
    已收款: customer.receivedText,
    未收款: customer.receivableText,
    预收款: customer.prepaidText,
    最近下单: customer.lastOrderDate || '',
    最近订单: customer.lastOrderNo || '',
    备注: customer.remark || ''
  }))

  return buildCsv(
    ['客户名称', '客户编码', '联系电话', '客户分类', '客户区域', '详细地址', '合同金额', '已收款', '未收款', '预收款', '最近下单', '最近订单', '备注'],
    type === 'authorized' ? rows : rows
  )
}

function splitCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells.map(cell => cell.trim())
}

function importCustomerCsv(content) {
  const cleanContent = String(content || '').replace(/^\uFEFF/, '')
  const lines = cleanContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return {
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      failures: ['文件没有可导入的客户行']
    }
  }

  const headers = splitCsvLine(lines[0])
  let successCount = 0
  const failures = []

  lines.slice(1).forEach((line, rowIndex) => {
    const values = splitCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    const profile = {
      name: row['客户名称'] || row.name || row.customerName,
      phone: row['联系电话'] || row.phone,
      category: row['客户分类'] || row.category,
      address: row['详细地址'] || row.address,
      openingReceivable: row['期初欠款'] || row.openingReceivable,
      remark: row['备注'] || row.remark
    }
    const result = saveCustomerProfile(profile)
    if (result.ok) {
      successCount += 1
    } else {
      failures.push(`第 ${rowIndex + 2} 行：${result.message}`)
    }
  })

  return {
    totalCount: lines.length - 1,
    successCount,
    failedCount: failures.length,
    failures: failures.slice(0, 3)
  }
}

function getImportExportCenter() {
  return {
    importTitle: '客户批量导入',
    importDesc: '前端负责选择 Excel / CSV 文件并创建上传任务；接入后端后由接口接收文件、解析表格并回写客户资料。',
    exportTitle: '客户批量导出',
    exportDesc: '按当前客户数据生成可打开的 CSV 文件；后续接入后端后再替换成真实下载链接。',
    importHint: '当前不会在前端解析表格，任务会保留为待上传状态。',
    tasks: loadCustomerImportTasks()
  }
}

function getCustomerSummary() {
  const customers = getCustomerList()
  const receivableCents = customers.reduce((sum, customer) => sum + customer.receivableCents, 0)
  const prepaidCents = customers.reduce((sum, customer) => sum + customer.prepaidCents, 0)
  const receivableCount = customers.filter(customer => customer.receivableCents > 0).length

  return {
    title: '',
    metrics: [
      { key: 'receivableCustomers', label: '欠款客户', value: `${receivableCount}位`, tone: 'danger' },
      { key: 'receivable', label: '累计欠款', value: formatCompactMoney(receivableCents), tone: receivableCents ? 'danger' : 'success' },
      { key: 'prepaid', label: '预收余额', value: formatCompactMoney(prepaidCents), tone: prepaidCents ? 'primary' : 'success' }
    ]
  }
}

function getCustomerDetail(id) {
  const customerId = decodeURIComponent(id || '')
  const customers = getCustomerList()
  const customer = customers.find(item => item.id === customerId) || customers[0]

  if (!customer) {
    return {
      customer: {},
      amountMetrics: [],
      salesRecords: [],
      fundRecords: [],
      tabs: [],
      recordFilters: [],
      fundFilters: [],
      recordSummary: ''
    }
  }

  const orders = loadOrders()
    .map(order => normalizeOrder(order))
    .filter(order => order.customer.name === customer.name)
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate))

  const salesRecords = orders.map(order => {
    const payment = paymentMeta[order.paymentState] || paymentMeta.unpaid
    const isRefund = order.paymentState === 'refunded'
    const unpaidCents = getUnpaidCents(order)
    return {
      id: order.id,
      no: order.no,
      date: order.saleDate,
      creator: order.creator,
      goodsSummary: order.goodsSummary,
      typeText: isRefund ? '退货单' : '销售单',
      typeTone: isRefund ? 'muted' : 'primary',
      statusText: payment.text,
      statusTone: payment.tone,
      contractText: formatMoney(isRefund ? -order.contractCents : order.contractCents),
      receivedText: formatMoney(order.receivedCents),
      unpaidText: isRefund ? formatMoney(-order.refundCents) : formatMoney(unpaidCents),
      contractTone: isRefund ? 'danger' : 'normal',
      receivedTone: order.receivedCents ? 'success' : 'normal',
      unpaidTone: unpaidCents ? 'danger' : 'success',
      canReceive: ['unpaid', 'partial'].includes(order.paymentState) && unpaidCents > 0,
      actionText: ['unpaid', 'partial'].includes(order.paymentState) && unpaidCents > 0 ? '收款' : '详情'
    }
  })

  const orderFundRecords = orders.flatMap(order => {
    const records = order.receiptRecords || []
    const isRefund = order.paymentState === 'refunded'
    const orderTypeText = isRefund ? '退货单' : '销售单'
    const orderTypeTone = isRefund ? 'muted' : 'primary'
    return records.map(record => {
      const flowKind = record.amountCents < 0
        ? 'refund'
        : record.type.includes('预收') || order.prepaidBalanceCents > 0
          ? 'prepaid'
          : 'receivable'
      const flowMeta = flowKind === 'refund'
        ? { text: '退款', tone: 'danger' }
        : flowKind === 'prepaid'
          ? { text: '冲销预收', tone: 'primary' }
          : { text: '应收款', tone: 'success' }

      return {
        id: `${order.id}-${record.no}`,
        no: record.no,
        orderNo: order.no,
        date: record.date,
        type: record.type,
        orderTypeText,
        orderTypeTone,
        flowKind,
        flowTypeText: flowMeta.text,
        flowTypeTone: flowMeta.tone,
        amountText: formatMoney(record.amountCents, { plus: record.amountCents > 0 }),
        amountTone: record.amountCents < 0 ? 'danger' : 'success',
        rule: record.rule
      }
    })
  })
  const customerFundRecords = getCustomerFundRecords(customer.name).map(record => {
    const isPrepaidIn = record.amountCents > 0
    return {
      id: record.id,
      no: record.id,
      orderNo: '客户账户',
      date: record.date,
      type: record.typeText,
      orderTypeText: '客户账户',
      orderTypeTone: 'primary',
      flowKind: 'prepaid',
      flowTypeText: isPrepaidIn ? '计入预收' : '使用预收',
      flowTypeTone: 'primary',
      amountText: formatMoney(record.amountCents, { plus: record.amountCents > 0 }),
      amountTone: isPrepaidIn ? 'success' : 'primary',
      rule: record.rule
    }
  })
  const fundRecords = orderFundRecords
    .concat(customerFundRecords)
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    customer,
    amountMetrics: [
      { label: '合同金额', value: customer.contractText, tone: 'normal' },
      { label: '已收款', value: customer.receivedText, tone: 'success' },
      { label: '未收款', value: customer.receivableText, tone: customer.receivableCents ? 'danger' : 'success' },
      { label: '预收款', value: customer.prepaidText, tone: customer.prepaidCents ? 'primary' : 'normal' }
    ],
    tabs: [
      { label: '销售记录', value: 'sales', count: salesRecords.length },
      { label: '资金流水', value: 'funds', count: fundRecords.length }
    ],
    recordFilters: [
      { label: '全部', value: 'all' },
      { label: '销售单', value: 'sale' },
      { label: '退货单', value: 'refund' }
    ],
    fundFilters: [
      { label: '全部', value: 'all' },
      { label: '应收款', value: 'receivable' },
      { label: '退款', value: 'refund' },
      { label: '冲销预收', value: 'prepaid' }
    ],
    salesRecords,
    fundRecords,
    recordSummary: `${salesRecords.length}单 / 流水${fundRecords.length}笔`
  }
}

function getFundFlowKind(order, record) {
  if (record.amountCents < 0) return 'refund'
  if (record.type.includes('预收') || order.prepaidBalanceCents > 0 || record.type.includes('冲抵')) return 'prepaid'
  return 'receivable'
}

function getFundFlowMeta(flowKind) {
  if (flowKind === 'refund') return { text: '退款', tone: 'danger' }
  if (flowKind === 'prepaid') return { text: '冲销预收', tone: 'success' }
  return { text: '收款入账', tone: 'success' }
}

function buildOrderFundDetail(order, record) {
  const normalized = normalizeOrder(order)
  const flowKind = getFundFlowKind(normalized, record)
  const flowMeta = getFundFlowMeta(flowKind)
  const isRefund = flowKind === 'refund'
  const isPrepaid = flowKind === 'prepaid'
  const amountCents = Number(record.amountCents || 0)
  const actionLabel = isRefund ? '退款' : isPrepaid ? '冲抵' : '收款'
  const cashAmountCents = isPrepaid ? 0 : amountCents
  const prepaidAmountCents = isPrepaid ? amountCents : 0

  return {
    id: `${normalized.id}-${record.no}`,
    no: record.no,
    title: '收款详情',
    statusText: flowMeta.text,
    statusTone: flowMeta.tone,
    infoDesc: isPrepaid
      ? '该记录由销售单使用预收款自动生成，不进入现金账户。'
      : isRefund
        ? '该记录由退货或冲抵产生，已回写客户往来。'
        : '该记录由销售单收款生成，已进入现金账户并回写客户往来。',
    basicRows: [
      { label: '收款单号', value: record.no, tone: 'normal' },
      { label: '客户', value: normalized.customer.name, tone: 'strong' },
      { label: '日期', value: record.date, tone: 'normal' },
      { label: isRefund ? '退款金额' : isPrepaid ? '冲销金额' : '收款金额', value: formatMoney(amountCents), tone: isRefund ? 'danger' : 'success' },
      { label: '状态', value: isPrepaid ? '已冲销 · 计入销售单已收' : isRefund ? '已退款 · 已回写客户往来' : '已收款 · 计入现金账户', tone: isRefund ? 'danger' : 'success' }
    ],
    relatedOrder: {
      id: normalized.id,
      no: normalized.no,
      statusText: isPrepaid ? '预收冲抵' : paymentMeta[normalized.paymentState].text,
      statusTone: isPrepaid ? 'success' : paymentMeta[normalized.paymentState].tone,
      metrics: [
        { label: '合同', value: formatMoney(normalized.contractCents), tone: 'normal' },
        { label: actionLabel, value: formatMoney(amountCents), tone: isRefund ? 'danger' : 'success' },
        { label: '未收', value: formatMoney(getUnpaidCents(normalized)), tone: getUnpaidCents(normalized) ? 'danger' : 'success' }
      ]
    },
    resultRows: [
      { label: isPrepaid ? '冲销预收金额' : isRefund ? '退款金额' : '本次收款金额', value: formatMoney(amountCents), tone: isRefund ? 'danger' : 'success' },
      { label: '现金账户入账', value: formatMoney(cashAmountCents), tone: cashAmountCents ? 'success' : 'muted' },
      { label: '客户预收余额', value: formatMoney(getCustomerFundBalance(normalized.customer.name) - prepaidAmountCents), tone: 'normal' }
    ],
    resultNote: isPrepaid
      ? '负数退款记录已生成一笔预收冲销；不会再生成现金收款流水。'
      : isRefund
        ? '退款记录已回写客户往来，销售单状态同步更新。'
        : '现金收款已进入本单收款记录，客户详情资金流水可查看。'
  }
}

function buildCustomerFundDetail(record) {
  const isPrepaidIn = Number(record.amountCents || 0) > 0
  return {
    id: record.id,
    no: record.id,
    title: '收款详情',
    statusText: isPrepaidIn ? '计入预收' : '使用预收',
    statusTone: isPrepaidIn ? 'success' : 'primary',
    infoDesc: isPrepaidIn
      ? '该记录来自客户账户预收款，可用于后续销售单冲抵。'
      : '该记录来自客户整体收款时使用预收款冲抵欠款。',
    basicRows: [
      { label: '流水单号', value: record.id, tone: 'normal' },
      { label: '客户', value: record.customerName, tone: 'strong' },
      { label: '日期', value: record.date, tone: 'normal' },
      { label: isPrepaidIn ? '预收金额' : '使用金额', value: formatMoney(record.amountCents), tone: isPrepaidIn ? 'success' : 'primary' },
      { label: '状态', value: isPrepaidIn ? '已计入 · 客户预收账户' : '已冲抵 · 客户预收账户', tone: isPrepaidIn ? 'success' : 'primary' }
    ],
    relatedOrder: null,
    resultRows: [
      { label: '客户预收变动', value: formatMoney(record.amountCents, { plus: record.amountCents > 0 }), tone: isPrepaidIn ? 'success' : 'primary' },
      { label: '现金账户入账', value: isPrepaidIn ? formatMoney(record.amountCents) : formatMoney(0), tone: isPrepaidIn ? 'success' : 'muted' },
      { label: '客户预收余额', value: formatMoney(getCustomerFundBalance(record.customerName)), tone: 'normal' }
    ],
    resultNote: record.rule || '该客户账户流水已同步至客户详情资金流水。'
  }
}

function getFundDetail(id) {
  const fundId = decodeURIComponent(id || '')

  for (const order of loadOrders()) {
    const records = order.receiptRecords || []
    const record = records.find(item => `${order.id}-${item.no}` === fundId || item.no === fundId)
    if (record) return buildOrderFundDetail(order, record)
  }

  const customerFund = loadCustomerFunds().find(record => record.id === fundId)
  if (customerFund) return buildCustomerFundDetail(customerFund)

  return null
}

function getAmountRows(order) {
  const rows = [
    { key: 'orderAmount', label: '订单金额', value: formatMoney(order.orderCents), tone: 'normal' },
    { key: 'discountAmount', label: '优惠金额', value: formatMoney(-order.discountCents), tone: order.discountCents ? 'primary' : 'normal' },
    { key: 'contractAmount', label: '合同金额', value: formatMoney(order.contractCents), tone: 'danger' },
    { key: 'divider', divider: true },
    { key: 'receivedAmount', label: '已收金额', value: formatMoney(order.receivedCents), tone: 'success' }
  ]

  if (order.refundCents) {
    rows.push({ key: 'refundAmount', label: '已退金额', value: formatMoney(-order.refundCents), tone: 'danger' })
  }

  if (order.prepaidBalanceCents) {
    rows.push({ key: 'prepaidAmount', label: '计入预收', value: formatMoney(order.prepaidBalanceCents), tone: 'primary' })
  }

  if (getOverpaidCents(order)) {
    rows.push({ key: 'overpaidAmount', label: '超收金额', value: formatMoney(getOverpaidCents(order), { plus: true }), tone: 'primary' })
  }

  rows.push({ key: 'unreceivedAmount', label: '未收金额', value: formatMoney(getUnpaidCents(order)), tone: getUnpaidCents(order) ? 'danger' : 'success' })

  return rows
}

function getAmountNote(order) {
  if (order.paymentState === 'refunded') return '退款完成后，本单不再进入待收款列表。'
  if (order.paymentState === 'prepaid') return '本单付款已进入客户预收余额，后续可用于冲抵新单。'
  if (order.paymentState === 'overpaid') return '超收金额会进入客户往来，后续可冲抵新单。'
  if (getUnpaidCents(order) > 0) return '未收金额需要后续从销售单详情发起收款。'
  return '本单已完成收款，客户往来已结清。'
}

function getReceiptInfo(order) {
  const records = order.receiptRecords || []
  const latest = records[records.length - 1]

  if (!latest) {
    return {
      desc: '本单还没有收款记录，可从底部进入收款。',
      type: '未收款',
      no: '',
      amount: '',
      rule: '',
      remaining: `仍需收款 ${formatMoney(getUnpaidCents(order))}`,
      tone: 'danger',
      amountTone: 'danger',
      emptyText: '暂无收款记录',
      emptyHint: '收款后会自动回写销售单详情。'
    }
  }

  const tone = order.paymentState === 'paid' ? 'success' : paymentMeta[order.paymentState].tone
  const remaining = order.paymentState === 'paid'
    ? '已结清'
    : order.paymentState === 'overpaid'
      ? `超收 ${formatMoney(getOverpaidCents(order))}`
      : order.paymentState === 'prepaid'
        ? '无需收款'
        : order.paymentState === 'refunded'
          ? '已退款'
          : `仍需收款 ${formatMoney(getUnpaidCents(order))}`

  return {
    desc: order.paymentState === 'partial' ? '本单已有收款记录，剩余未收可继续收款。' : '本单收款记录已回写。',
    type: latest.type,
    no: latest.no,
    amount: formatMoney(latest.amountCents),
    rule: latest.rule,
    remaining,
    tone,
    amountTone: latest.amountCents < 0 ? 'danger' : tone,
    emptyText: '',
    emptyHint: ''
  }
}

function getOrderDetail(id) {
  const order = normalizeOrder(findOrder(id))
  const payment = paymentMeta[order.paymentState] || paymentMeta.unpaid
  const print = printMeta[order.printState] || printMeta.unprinted

  return {
    id: order.id,
    no: order.no,
    statusText: payment.text,
    statusTone: payment.tone,
    canReceive: ['unpaid', 'partial'].includes(order.paymentState) && getUnpaidCents(order) > 0,
    printActionText: order.printState === 'printed' ? '再次打印' : '打印',
    successTitle: '销售单已生成',
    successDesc: '下单后自动更新客户往来，预收冲抵已记录。',
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.address,
      date: order.saleDate,
      warehouse: order.warehouse,
      printStatus: print.text
    },
    amounts: getAmountRows(order),
    amountNote: getAmountNote(order),
    receipt: getReceiptInfo(order),
    products: order.products.map(product => ({
      id: product.id,
      name: product.name,
      color: product.color,
      qty: product.qty,
      price: formatMoney(product.priceCents),
      amount: formatMoney(product.amountCents)
    })),
    printDesc: '保存后的销售单支持按模板分享或打印。'
  }
}

function getReceiptOrder(id) {
  const order = normalizeOrder(findOrder(id))

  return {
    id: order.id,
    no: order.no,
    customer: order.customer.name,
    contractCents: order.contractCents,
    receivedCents: order.receivedCents,
    unpaidCents: getUnpaidCents(order),
    defaultReceiptCents: getUnpaidCents(order),
    receiptDate: today,
    remark: '补录本单收款。',
    contractText: formatMoney(order.contractCents),
    receivedText: formatMoney(order.receivedCents),
    unpaidText: formatMoney(getUnpaidCents(order))
  }
}

function getReceivableCustomerOrders(customerName) {
  return loadOrders()
    .map(order => normalizeOrder(order))
    .filter(order => order.customer.name === customerName && getUnpaidCents(order) > 0 && ['unpaid', 'partial'].includes(order.paymentState))
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate))
}

function buildCustomerReceiptAllocation(receivableOrders, amountCents) {
  let remainingCents = Number(amountCents || 0)
  return receivableOrders.map(order => {
    const unpaidCents = getUnpaidCents(order)
    const allocatedCents = Math.max(Math.min(remainingCents, unpaidCents), 0)
    remainingCents -= allocatedCents
    const afterUnpaidCents = unpaidCents - allocatedCents
    const status = allocatedCents <= 0
      ? { text: '未分摊', tone: 'muted' }
      : afterUnpaidCents <= 0
        ? { text: '已分摊', tone: 'success' }
        : { text: '部分分摊', tone: 'warning' }
    const result = allocatedCents <= 0
      ? { text: '本次未分摊，欠款保持不变', tone: 'muted' }
      : afterUnpaidCents <= 0
        ? { text: `本次已分摊 ${formatMoney(allocatedCents)}，本单已结清`, tone: 'success' }
        : { text: `本次已分摊 ${formatMoney(allocatedCents)}，收后欠款 ${formatMoney(afterUnpaidCents)}`, tone: 'warning' }

    return {
      id: order.id,
      no: order.no,
      date: order.saleDate,
      goodsSummary: order.goodsSummary,
      contractCents: order.contractCents,
      receivedCents: order.receivedCents,
      unpaidCents,
      allocatedCents,
      afterUnpaidCents,
      isAllocated: allocatedCents > 0,
      allocatedTone: allocatedCents > 0 ? 'success' : 'muted',
      contractText: formatMoney(order.contractCents),
      receivedText: formatMoney(order.receivedCents),
      unpaidText: formatMoney(unpaidCents),
      allocatedText: formatMoney(allocatedCents, { plus: true }),
      afterUnpaidText: formatMoney(afterUnpaidCents),
      statusText: status.text,
      statusTone: status.tone,
      resultText: result.text,
      resultTone: result.tone
    }
  })
}

function getCustomerReceipt(customerId, amountCents, options = {}) {
  const customerName = decodeURIComponent(customerId || '')
  const customer = getCustomerList().find(item => item.id === customerName) || getCustomerList()[0]
  const receivableOrders = getReceivableCustomerOrders(customer.name)
  const totalUnpaidCents = receivableOrders.reduce((sum, order) => sum + getUnpaidCents(order), 0)
  const receiptCents = amountCents === undefined ? totalUnpaidCents : Number(amountCents || 0)
  const prepayMode = Boolean(options.prepayMode)
  const usePrepaid = Boolean(options.usePrepaid)
  const availablePrepaidCents = Number(customer.prepaidCents || 0)
  const usePrepaidCents = usePrepaid ? Math.min(availablePrepaidCents, totalUnpaidCents) : 0
  const allocationSourceCents = prepayMode ? usePrepaidCents : receiptCents + usePrepaidCents
  const allocation = buildCustomerReceiptAllocation(receivableOrders, allocationSourceCents)
  const allocatedCount = allocation.filter(item => item.allocatedCents > 0).length
  const displayAllocation = allocation
  const afterUnpaidCents = Math.max(totalUnpaidCents - allocationSourceCents, 0)
  const prepaidAfterCents = prepayMode
    ? availablePrepaidCents - usePrepaidCents + receiptCents
    : availablePrepaidCents - usePrepaidCents
  const previewRows = prepayMode
    ? [
        { label: '收款前累计欠款', value: formatMoney(totalUnpaidCents), tone: 'normal' },
        { label: '使用预收款', value: formatMoney(-usePrepaidCents), tone: 'primary' },
        { label: '本次转入预收款', value: formatMoney(receiptCents, { plus: true }), tone: 'success' },
        { label: '收款后累计欠款', value: formatMoney(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
        { label: '预收款余额', value: formatMoney(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
      ]
    : [
        { label: '收款前累计欠款', value: formatMoney(totalUnpaidCents), tone: 'normal' },
        { label: '本次收款', value: formatMoney(-receiptCents), tone: 'success' },
        { label: '收款后累计欠款', value: formatMoney(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
        { label: '预收款余额', value: formatMoney(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
      ]

  return {
    customer,
    receiptDate: today,
    remark: '客户整体收款，按销售日期从旧到新自动分摊。',
    prepayRemark: '客户预收款，暂不分摊销售单。',
    totalUnpaidCents,
    receiptCents,
    usePrepaid,
    prepayMode,
    usePrepaidCents,
    availablePrepaidCents,
    afterUnpaidCents,
    prepaidAfterCents,
    defaultReceiptCents: totalUnpaidCents,
    totalUnpaidText: formatMoney(totalUnpaidCents),
    receiptText: formatMoney(receiptCents),
    afterUnpaidText: formatMoney(afterUnpaidCents),
    availablePrepaidText: formatMoney(availablePrepaidCents),
    usePrepaidText: formatMoney(usePrepaidCents),
    prepaidAfterText: formatMoney(prepaidAfterCents),
    orderCount: receivableOrders.length,
    allocatedCount,
    allocation,
    displayAllocation,
    previewRows
  }
}

function recordCustomerReceipt(customerId, receipt) {
  const customerName = decodeURIComponent(customerId || '')
  const orders = loadOrders()
  const receivableOrders = getReceivableCustomerOrders(customerName)
  const cashCents = Number(receipt.amountCents || 0)
  const usePrepaidCents = Number(receipt.usePrepaidCents || 0)
  let remainingCents = cashCents + usePrepaidCents
  const receiptNo = `CR${String(Date.now()).slice(-10)}`

  if (usePrepaidCents > 0) {
    appendCustomerFund({
      id: `${receiptNo}-PREPAID`,
      customerName,
      type: 'use-prepaid',
      typeText: '使用预收款',
      amountCents: -usePrepaidCents,
      date: receipt.date || today,
      remark: receipt.remark || '',
      rule: `整体收款使用客户预收款 ${formatMoney(usePrepaidCents)} 冲抵销售单欠款。`
    })
  }

  receivableOrders.forEach(receivableOrder => {
    if (remainingCents <= 0) return

    const index = orders.findIndex(order => order.id === receivableOrder.id)
    if (index < 0) return

    const order = orders[index]
    const unpaidCents = getUnpaidCents(normalizeOrder(order))
    const allocatedCents = Math.min(unpaidCents, remainingCents)
    if (allocatedCents <= 0) return

    order.receivedCents += allocatedCents
    order.receiptRecords = order.receiptRecords || []
    order.receiptRecords.push({
      no: `${receiptNo}-${order.no.slice(-4)}`,
      type: usePrepaidCents > 0 ? '客户整体收款含预收冲抵' : '客户整体收款',
      amountCents: allocatedCents,
      date: receipt.date || today,
      rule: `${receipt.remark || '客户整体收款自动分摊。'} 分摊至本单 ${formatMoney(allocatedCents)}。`
    })
    orders[index] = normalizeOrder(order)
    remainingCents -= allocatedCents
  })

  cachedOrders = orders
  saveOrders()
  return getCustomerReceipt(customerId)
}

function recordCustomerPrepayment(customerId, receipt) {
  const customerName = decodeURIComponent(customerId || '')
  const amountCents = Number(receipt.amountCents || 0)
  const usePrepaidCents = Number(receipt.usePrepaidCents || 0)
  const receiptNo = `CP${String(Date.now()).slice(-10)}`

  if (usePrepaidCents > 0) {
    recordCustomerReceipt(customerName, {
      amountCents: 0,
      usePrepaidCents,
      date: receipt.date || today,
      remark: '预收款处理时优先冲抵历史欠款。'
    })
  }

  if (amountCents > 0) {
    appendCustomerFund({
      id: receiptNo,
      customerName,
      type: 'prepaid',
      typeText: '客户预收款',
      amountCents,
      date: receipt.date || today,
      remark: receipt.remark || '',
      rule: receipt.remark || '本次金额转入客户预收款余额，暂不自动分摊销售单。'
    })
  }

  return getCustomerReceipt(customerId, amountCents, {
    usePrepaid: usePrepaidCents > 0,
    prepayMode: true
  })
}

function recordReceipt(id, receipt) {
  const orders = loadOrders()
  const index = orders.findIndex(order => order.id === id)
  if (index < 0) return null

  const order = orders[index]
  const amountCents = Number(receipt.amountCents || 0)
  const receiptNo = `R${String(Date.now()).slice(-10)}`
  order.receivedCents += amountCents
  order.receiptRecords = order.receiptRecords || []
  order.receiptRecords.push({
    no: receiptNo,
    type: '销售单收款',
    amountCents,
    date: receipt.date || today,
    rule: receipt.remark || '本单收款已回写销售单详情。'
  })
  orders[index] = normalizeOrder(order)
  cachedOrders = orders
  saveOrders()
  return getOrderDetail(id)
}

function markPrinted(id) {
  const orders = loadOrders()
  const index = orders.findIndex(order => order.id === id)
  if (index < 0) return null

  orders[index] = {
    ...orders[index],
    printState: 'printed'
  }
  cachedOrders = orders
  saveOrders()
  return getOrderDetail(id)
}

module.exports = {
  formatAmountInput,
  formatMoney,
  getCustomerDetail,
  getCustomerForm,
  getCustomerImportExport: getImportExportCenter,
  getCustomerExportCsv,
  getCustomerImportTask,
  getCustomerTemplateCsv,
  getCustomerList,
  getCustomerReceipt,
  getCustomerSummary,
  getFundDetail,
  getOrderDetail,
  getOrderList,
  getOrderSummary,
  getReceiptOrder,
  markPrinted,
  parseAmountInput,
  addCustomerImportTask,
  recordCustomerPrepayment,
  recordCustomerReceipt,
  recordReceipt,
  saveCustomerProfile,
  updateCustomerImportTask
}
