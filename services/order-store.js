const storageKey = 'textile_order_store_v1'

const today = '2026-04-28'

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

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadOrders() {
  if (cachedOrders) return cachedOrders

  if (canUseStorage()) {
    const stored = wx.getStorageSync(storageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedOrders = stored
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

function formatAmountInput(cents) {
  return (cents / 100).toFixed(2)
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
  getOrderDetail,
  getOrderList,
  getOrderSummary,
  getReceiptOrder,
  markPrinted,
  recordReceipt
}
