const { ok, fail } = require('../response')
const ExcelJS = require('exceljs')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')

const defaultOrgCode = 'org-main'
const today = '2026-04-28'
const salesPaymentMeta = {
  unpaid: { text: '未收款', tone: 'danger' },
  partial: { text: '部分收款', tone: 'warning' },
  paid: { text: '已收款', tone: 'success' },
  overpaid: { text: '超收款', tone: 'primary' },
  prepaid: { text: '计入预收', tone: 'primary' },
  refunded: { text: '已退款', tone: 'muted' }
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function amountToNumber(value) {
  return Number(value || 0)
}

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function parseAmount(payload, amountKey, centsKey, fallback = '0.00') {
  if (payload && payload[centsKey] !== undefined) return centsToAmount(payload[centsKey])
  if (payload && payload[amountKey] !== undefined) return String(Number(payload[amountKey] || 0).toFixed(2))
  return fallback
}

function formatAmount(cents, options = {}) {
  const amount = Number(cents || 0) / 100
  const sign = options.plus && amount > 0 ? '+' : ''
  return `${sign}¥${amount.toFixed(2)}`
}

function formatCompactAmount(cents) {
  const amount = Number(cents || 0) / 100
  if (Math.abs(amount) >= 10000) return `¥${(amount / 10000).toFixed(1)}万`
  return `¥${amount.toFixed(2)}`
}

function formatDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function parseDate(value, fallback = new Date()) {
  const text = String(value || '').trim()
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback
  return new Date(`${text}T00:00:00.000Z`)
}

function toBoolean(value) {
  if (value === true || value === false) return value
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function getPaymentState(contractCents, receivedCents) {
  if (receivedCents > contractCents) return 'overpaid'
  if (contractCents > 0 && receivedCents >= contractCents) return 'paid'
  if (receivedCents > 0) return 'partial'
  return 'unpaid'
}

function getFundDisplayNo(record) {
  const note = String(record && record.note || '')
  const receiptNo = note.match(/\bSK\d{10,}\b/)
  if (receiptNo) return receiptNo[0]
  const dateText = formatDate(record && record.occurredAt).replace(/-/g, '') || '00000000'
  const suffix = String(record && record.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()
  return `LS${dateText}${suffix || '000000'}`
}

function getFundOrderNo(record) {
  return record && record.order ? record.order.orderNo : '客户账户'
}

function getFundDisplayNote(record) {
  const raw = String(record && record.note || '').trim()
  const orderNo = record && record.order ? record.order.orderNo : ''
  let clean = raw.replace(/^\[seed:[^\]]+\]\s*/i, '').trim()
  clean = clean.replace(/\bSK\d{10,}\b\s*/g, '').trim()
  if (!clean || clean === orderNo) {
    if (record && record.type === 'sales_receipt' && orderNo) return `销售单 ${orderNo} 的收款已回写客户往来。`
    if (record && record.type === 'prepayment_offset' && orderNo) return `销售单 ${orderNo} 已使用预收款冲抵。`
    if (record && record.type === 'prepayment') return '该笔金额已计入客户预收余额。'
    if (record && record.type === 'customer_receipt') return '客户整体收款已回写客户往来。'
    return '该资金流水来自真实数据库记录。'
  }
  return clean
}

function normalizeKeyword(value) {
  return String(value || '').trim()
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

function hasPayloadField(payload, keys) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(payload || {}, key))
}

function firstPayloadValue(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload || {}, key)) return payload[key]
  }
  return undefined
}

function validateLength(errors, label, value, max) {
  if (String(value || '').length > max) errors.push(`${label}不能超过${max}字`)
}

function validateCustomerAmount(errors, label, value) {
  const raw = normalizeKeyword(value)
  if (!raw) return ''
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    errors.push(`${label}请输入非负金额，最多2位小数`)
    return raw
  }
  if (Number(raw) > 999999999.99) {
    errors.push(`${label}不能超过999999999.99`)
    return raw
  }
  return Number(raw).toFixed(2)
}

async function validateCustomerPayload(prisma, orgId, payload, options = {}) {
  const partial = Boolean(options.partial)
  const errors = []
  const patch = {}

  const namePresent = hasPayloadField(payload, ['customer_name', 'name'])
  const name = normalizeKeyword(firstPayloadValue(payload, ['customer_name', 'name']))
  if (!partial || namePresent) {
    if (!name) errors.push('请输入客户名称')
    validateLength(errors, '客户名称', name, 120)
    if (name) {
      patch.customer_name = name
      patch.name = name
    }
  }

  const phonePresent = hasPayloadField(payload, ['phone'])
  const phone = normalizeKeyword(firstPayloadValue(payload, ['phone']))
  if (!partial || phonePresent) {
    if (phone && !/^1\d{10}$/.test(phone)) errors.push('请输入11位手机号')
    patch.phone = phone
  }

  const categoryPresent = hasPayloadField(payload, ['customer_category_id', 'categoryId', 'customer_category', 'category'])
  const categoryId = normalizeKeyword(firstPayloadValue(payload, ['customer_category_id', 'categoryId']))
  const categoryName = normalizeKeyword(firstPayloadValue(payload, ['customer_category', 'category', 'tag']))
  if (!partial || categoryPresent) {
    let category = null
    if (categoryId) {
      category = await prisma.customerCategory.findFirst({
        where: {
          id: categoryId,
          org_id: orgId,
          is_active: true
        }
      })
      if (!category) errors.push('客户分类不存在或已停用')
    } else if (categoryName) {
      category = await prisma.customerCategory.findFirst({
        where: {
          org_id: orgId,
          name: categoryName,
          is_active: true
        }
      })
      if (!category) errors.push('请选择已有客户分类')
    } else {
      errors.push('请选择客户分类')
    }

    if (category) {
      patch.customer_category_id = category.id
      patch.categoryId = category.id
      patch.customer_category = category.name
      patch.category = category.name
    }
  }

  const address = normalizeKeyword(firstPayloadValue(payload, ['detail_address', 'detailAddress', 'address']))
  validateLength(errors, '详细地址', address, 255)
  if (hasPayloadField(payload, ['detail_address', 'detailAddress', 'address'])) {
    patch.detail_address = address
    patch.address = address
  }

  const remark = normalizeKeyword(firstPayloadValue(payload, ['remark']))
  validateLength(errors, '备注', remark, 500)
  if (hasPayloadField(payload, ['remark'])) patch.remark = remark

  const amountFields = [
    ['opening_debt', 'openingDebtCents', 'openingReceivable', 'openingReceivableCents', '期初欠款'],
    ['contract_amount', 'contractCents', null, null, '合同金额'],
    ['delivered_amount', 'deliveredCents', null, null, '发货金额'],
    ['prepaid_amount', 'prepaidCents', null, null, '预收金额'],
    ['unpaid_amount', 'receivableCents', null, null, '未收金额'],
    ['paid_amount', 'receivedCents', null, null, '已收金额']
  ]
  amountFields.forEach(([amountKey, centsKey, aliasKey, aliasCentsKey, label]) => {
    const keys = [amountKey, centsKey, aliasKey, aliasCentsKey].filter(Boolean)
    if (partial && !hasPayloadField(payload, keys)) return
    if (hasPayloadField(payload, [centsKey, aliasCentsKey].filter(Boolean))) {
      const cents = Number(firstPayloadValue(payload, [centsKey, aliasCentsKey].filter(Boolean)))
      if (!Number.isFinite(cents) || cents < 0) errors.push(`${label}请输入非负金额`)
      return
    }
    if (!hasPayloadField(payload, [amountKey, aliasKey].filter(Boolean))) return
    const normalizedAmount = validateCustomerAmount(errors, label, firstPayloadValue(payload, [amountKey, aliasKey].filter(Boolean)))
    if (amountKey === 'opening_debt') {
      patch.opening_debt = normalizedAmount
      patch.openingReceivable = normalizedAmount
    } else {
      patch[amountKey] = normalizedAmount
    }
  })

  return {
    errors,
    payload: {
      ...payload,
      ...patch
    }
  }
}

function inferArea(customer) {
  return customer.province || customer.city || customer.customer_category || '未分区'
}

function buildStatus(customer) {
  const unpaidCents = amountToCents(customer.unpaid_amount)
  const prepaidCents = amountToCents(customer.prepaid_amount)
  if (unpaidCents > 0) {
    return {
      statusKey: 'receivable',
      statusText: '有欠款',
      statusTone: 'danger',
      balanceLabel: '累计欠款',
      balanceText: formatAmount(unpaidCents),
      balanceTone: 'danger'
    }
  }
  if (prepaidCents > 0) {
    return {
      statusKey: 'prepaid',
      statusText: '有预收',
      statusTone: 'primary',
      balanceLabel: '预收余额',
      balanceText: formatAmount(prepaidCents),
      balanceTone: 'primary'
    }
  }
  return {
    statusKey: 'settled',
    statusText: '已结清',
    statusTone: 'success',
    balanceLabel: '当前余额',
    balanceText: formatAmount(0),
    balanceTone: 'success'
  }
}

function buildCustomerDto(customer) {
  const id = String(customer.id)
  const contractCents = amountToCents(customer.contract_amount)
  const deliveredCents = amountToCents(customer.delivered_amount)
  const prepaidCents = amountToCents(customer.prepaid_amount)
  const receivableCents = amountToCents(customer.unpaid_amount)
  const receivedCents = amountToCents(customer.paid_amount)
  const status = buildStatus(customer)
  const address = customer.detail_address || customer.address_short || ''
  const category = customer.customerCategory && customer.customerCategory.name || customer.customer_category || '未分类'
  const area = inferArea(customer)

  return {
    id,
    org_id: customer.org_id,
    customer_category_id: customer.customer_category_id || '',
    customer_name: customer.customer_name,
    customer_category: category,
    phone: customer.phone || '',
    backup_phone: customer.backup_phone || '',
    fax: customer.fax || '',
    remark: customer.remark || '',
    address_short: customer.address_short || '',
    province: customer.province || '',
    city: customer.city || '',
    district: customer.district || '',
    detail_address: customer.detail_address || '',
    address_remark: customer.address_remark || '',
    zipcode: customer.zipcode || '',
    opening_debt: String(customer.opening_debt || '0'),
    contract_amount: String(customer.contract_amount || '0'),
    delivered_amount: String(customer.delivered_amount || '0'),
    prepaid_amount: String(customer.prepaid_amount || '0'),
    unpaid_amount: String(customer.unpaid_amount || '0'),
    paid_amount: String(customer.paid_amount || '0'),
    is_active: customer.is_active,
    source_file: customer.source_file || '',
    source_sheet: customer.source_sheet || '',
    source_row_no: customer.source_row_no || 0,
    customer_name_normalized: customer.customer_name_normalized || '',
    customer_name_pinyin: customer.customer_name_pinyin || '',
    customer_name_initials: customer.customer_name_initials || '',
    created_at: customer.created_at,
    updated_at: customer.updated_at,

    name: customer.customer_name,
    code: `TC-${id.padStart(4, '0')}`,
    category,
    categoryId: customer.customer_category_id || '',
    tag: category,
    area,
    address,
    level: customer.customer_category && customer.customer_category.includes('重点') ? 'key' : 'normal',
    activeState: 'active',
    lastOrderDate: today,
    lastOrderNo: '',
    recentGoods: '',
    creatorsText: '',
    contractCents,
    deliveredCents,
    prepaidCents,
    receivableCents,
    receivedCents,
    contractText: formatAmount(contractCents),
    deliveredText: formatAmount(deliveredCents),
    prepaidText: formatAmount(prepaidCents),
    receivableText: formatAmount(receivableCents),
    receivedText: formatAmount(receivedCents),
    contractAmount: formatAmount(contractCents),
    receivable: formatAmount(receivableCents),
    chips: [],
    ...status
  }
}

function buildCustomerForm(customer) {
  if (!customer) {
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
  const dto = buildCustomerDto(customer)
  return {
    ...dto,
    mode: 'edit',
    openingReceivable: dto.opening_debt === '0' ? '' : String(dto.opening_debt)
  }
}

function buildCustomerDetail(customer, salesRecords = [], fundRecords = []) {
  const dto = buildCustomerDto(customer)
  return {
    customer: dto,
    form: buildCustomerForm(customer),
    amountMetrics: [
      { label: '合同金额', value: dto.contractText, tone: 'normal' },
      { label: '已收款', value: dto.receivedText, tone: 'success' },
      { label: '未收款', value: dto.receivableText, tone: dto.receivableCents ? 'danger' : 'success' },
      { label: '预收款', value: dto.prepaidText, tone: dto.prepaidCents ? 'primary' : 'normal' }
    ],
    tabs: [
      { label: '销售记录', value: 'sales', count: salesRecords.length },
      { label: '资金流水', value: 'funds', count: fundRecords.length }
    ],
    recordFilters: [
      { label: '全部', value: 'all' },
      { label: '销售单', value: 'sale' },
      { label: '退货单', value: 'refund' },
      { label: '可收款', value: 'receivable' }
    ],
    fundFilters: [
      { label: '全部', value: 'all' },
      { label: '应收款', value: 'receivable' },
      { label: '预收款', value: 'prepaid' },
      { label: '退款', value: 'refund' }
    ],
    salesRecords,
    fundRecords,
    recordSummary: `${salesRecords.length}单 / 流水${fundRecords.length}笔`
  }
}

function buildOrderGoodsSummary(order) {
  const items = order.items || []
  if (!items.length) return '无产品明细'
  const names = items.slice(0, 2).map(item => item.productName).join('、')
  return items.length > 2 ? `${names} 等${items.length}条明细` : `${names} ${items.length}条明细`
}

function buildReceiptAllocation(orders = [], distributionCents = 0) {
  let remaining = Math.max(Number(distributionCents || 0), 0)
  return orders.map(order => {
    const contractCents = amountToCents(order.contractAmount)
    const receivedCents = amountToCents(order.receivedAmount)
    const unpaidCents = amountToCents(order.unreceivedAmount)
    const allocatedCents = Math.min(unpaidCents, remaining)
    remaining -= allocatedCents
    const afterUnpaidCents = Math.max(unpaidCents - allocatedCents, 0)
    const isAllocated = allocatedCents > 0
    return {
      id: String(order.id),
      no: order.orderNo,
      date: formatDate(order.orderDate),
      goodsSummary: buildOrderGoodsSummary(order),
      contractCents,
      receivedCents,
      unpaidCents,
      allocatedCents,
      afterUnpaidCents,
      contractText: formatAmount(contractCents),
      receivedText: formatAmount(receivedCents),
      unpaidText: formatAmount(unpaidCents),
      allocatedText: isAllocated ? formatAmount(allocatedCents) : '¥0.00',
      allocatedTone: isAllocated ? 'success' : 'normal',
      statusText: isAllocated ? '已分摊' : '待收款',
      statusTone: isAllocated ? 'success' : 'danger',
      isAllocated,
      resultText: isAllocated
        ? afterUnpaidCents > 0
          ? `本次分摊 ${formatAmount(allocatedCents)}，剩余 ${formatAmount(afterUnpaidCents)}`
          : '本次结清'
        : '本次未分摊',
      resultTone: isAllocated ? (afterUnpaidCents > 0 ? 'danger' : 'success') : 'normal'
    }
  })
}

function buildReceipt(customer, amountCents, options = {}, receivableOrders = []) {
  const dto = buildCustomerDto(customer)
  const totalUnpaidCents = receivableOrders.length
    ? receivableOrders.reduce((sum, order) => sum + amountToCents(order.unreceivedAmount), 0)
    : dto.receivableCents
  const availablePrepaidCents = dto.prepaidCents
  const receiptCents = amountCents === undefined ? totalUnpaidCents : Number(amountCents || 0)
  const explicitUsePrepaidCents = Number(options.usePrepaidCents || 0)
  const usePrepaid = toBoolean(options.usePrepaid) || explicitUsePrepaidCents > 0
  const prepayMode = toBoolean(options.prepayMode)
  const usePrepaidCents = prepayMode
    ? 0
    : usePrepaid
      ? Math.min(explicitUsePrepaidCents || availablePrepaidCents, availablePrepaidCents, totalUnpaidCents)
      : 0
  const cashAllocatedCents = prepayMode ? 0 : Math.min(receiptCents, Math.max(totalUnpaidCents - usePrepaidCents, 0))
  const overpaidCents = prepayMode ? receiptCents : Math.max(receiptCents - cashAllocatedCents, 0)
  const distributionCents = prepayMode ? 0 : cashAllocatedCents + usePrepaidCents
  const afterUnpaidCents = Math.max(totalUnpaidCents - distributionCents, 0)
  const prepaidAfterCents = prepayMode
    ? availablePrepaidCents + receiptCents
    : availablePrepaidCents - usePrepaidCents + overpaidCents
  const allocation = buildReceiptAllocation(receivableOrders, distributionCents)
  const displayAllocation = allocation.filter(item => item.isAllocated || item.unpaidCents > 0)

  return {
    customer: dto,
    receiptDate: formatDate(new Date()),
    remark: prepayMode ? '客户预收款，暂不分摊销售单。' : '客户整体收款，按销售日期从旧到新自动分摊。',
    prepayRemark: '客户预收款，暂不分摊销售单。',
    totalUnpaidCents,
    receiptCents,
    usePrepaid,
    prepayMode,
    usePrepaidCents,
    cashAllocatedCents,
    overpaidCents,
    availablePrepaidCents,
    afterUnpaidCents,
    prepaidAfterCents,
    defaultReceiptCents: totalUnpaidCents,
    totalUnpaidText: formatAmount(totalUnpaidCents),
    receiptText: formatAmount(receiptCents),
    afterUnpaidText: formatAmount(afterUnpaidCents),
    availablePrepaidText: formatAmount(availablePrepaidCents),
    usePrepaidText: formatAmount(usePrepaidCents),
    prepaidAfterText: formatAmount(prepaidAfterCents),
    orderCount: receivableOrders.length,
    allocatedCount: allocation.filter(item => item.isAllocated).length,
    allocation,
    displayAllocation,
    previewRows: prepayMode
	      ? [
	          { label: '收款前累计欠款', value: formatAmount(totalUnpaidCents), tone: 'normal' },
	          { label: '本次转入预收款', value: formatAmount(receiptCents, { plus: true }), tone: 'success' },
	          { label: '收款后累计欠款', value: formatAmount(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
	          { label: '预收款余额', value: formatAmount(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
	        ]
	      : [
	          { label: '收款前累计欠款', value: formatAmount(totalUnpaidCents), tone: 'normal' },
	          { label: '本次收款', value: formatAmount(-receiptCents), tone: 'success' },
	          ...(usePrepaidCents > 0 ? [{ label: '使用预收款', value: formatAmount(-usePrepaidCents), tone: 'primary' }] : []),
	          ...(overpaidCents > 0 ? [{ label: '转入预收款', value: formatAmount(overpaidCents, { plus: true }), tone: 'primary' }] : []),
	          { label: '收款后累计欠款', value: formatAmount(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
	          { label: '预收款余额', value: formatAmount(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
	        ]
  }
}

function formatFundRecord(record) {
  const typeMap = {
    sales_receipt: { text: '销售收款', flowKind: 'receivable', tone: 'success' },
    customer_receipt: { text: '客户收款', flowKind: 'receivable', tone: 'success' },
    prepayment: { text: '客户预收', flowKind: 'prepaid', tone: 'primary' },
    prepayment_offset: { text: '冲销预收', flowKind: 'prepaid', tone: 'primary' },
    refund: { text: '退款', flowKind: 'refund', tone: 'danger' },
    adjustment: { text: '调整', flowKind: 'receivable', tone: 'normal' }
  }
  const meta = typeMap[record.type] || typeMap.adjustment
  const date = record.occurredAt instanceof Date
    ? record.occurredAt.toISOString().slice(0, 10)
    : String(record.occurredAt || '').slice(0, 10)

  return {
    id: record.id,
    no: getFundDisplayNo(record),
    orderNo: record.orderId ? getFundOrderNo(record) : '客户账户',
    date,
    type: meta.text,
    orderTypeText: record.orderId ? '销售单' : '客户账户',
    orderTypeTone: record.orderId ? 'primary' : 'muted',
    flowKind: meta.flowKind,
    flowTypeText: meta.text,
    flowTypeTone: meta.tone,
    amountText: formatAmount(record.amountCents, { plus: record.amountCents > 0 }),
    amountTone: record.amountCents < 0 ? 'danger' : meta.tone,
    rule: getFundDisplayNote(record)
  }
}

function buildFundDetail(record) {
  if (!record) return null
  const typeMap = {
    sales_receipt: { text: '销售收款', statusText: '收款入账', flowKind: 'receivable', tone: 'success' },
    customer_receipt: { text: '客户收款', statusText: '客户整体收款', flowKind: 'receivable', tone: 'success' },
    prepayment: { text: '客户预收', statusText: '计入预收', flowKind: 'prepaid', tone: 'primary' },
    prepayment_offset: { text: '冲销预收', statusText: '冲销预收', flowKind: 'prepaid', tone: 'primary' },
    refund: { text: '退款', statusText: '退款', flowKind: 'refund', tone: 'danger' },
    adjustment: { text: '调整', statusText: '往来调整', flowKind: 'receivable', tone: 'normal' }
  }
  const meta = typeMap[record.type] || typeMap.adjustment
  const amountCents = Number(record.amountCents || 0)
  const customer = record.customer ? buildCustomerDto(record.customer) : {}
  const order = record.order
  const orderUnpaidCents = order ? amountToCents(order.unreceivedAmount) : 0
  return {
    id: record.id,
    no: getFundDisplayNo(record),
    title: '收款详情',
    statusText: meta.statusText,
    statusTone: meta.tone,
    infoDesc: order
      ? '该流水来自销售单收款或预收冲抵，已回写销售单和客户往来。'
      : '该流水来自客户账户，已回写客户往来和资金账户。',
    basicRows: [
      { label: '流水单号', value: getFundDisplayNo(record), tone: 'normal' },
      { label: '客户', value: customer.name || '', tone: 'strong' },
      { label: '日期', value: formatDate(record.occurredAt), tone: 'normal' },
      { label: '类型', value: meta.text, tone: meta.tone },
      { label: '金额', value: formatAmount(amountCents, { plus: amountCents > 0 }), tone: amountCents < 0 ? 'danger' : meta.tone }
    ],
    relatedOrder: order
      ? {
          id: String(order.id),
          no: order.orderNo,
          statusText: (salesPaymentMeta[order.payStatus] || salesPaymentMeta.unpaid).text,
          statusTone: (salesPaymentMeta[order.payStatus] || salesPaymentMeta.unpaid).tone,
          metrics: [
            { label: '合同', value: formatAmount(amountToCents(order.contractAmount)), tone: 'normal' },
            { label: '已收', value: formatAmount(amountToCents(order.receivedAmount)), tone: 'success' },
            { label: '未收', value: formatAmount(orderUnpaidCents), tone: orderUnpaidCents ? 'danger' : 'success' }
          ]
        }
      : null,
    resultRows: [
      { label: '本次金额', value: formatAmount(amountCents, { plus: amountCents > 0 }), tone: amountCents < 0 ? 'danger' : meta.tone },
      { label: '流水后余额', value: formatAmount(record.balanceCents), tone: record.balanceCents < 0 ? 'danger' : 'success' },
      { label: '关联单据', value: order ? order.orderNo : '客户账户', tone: order ? 'primary' : 'normal' }
    ],
    resultNote: getFundDisplayNote(record)
  }
}

function formatCustomerSalesOrder(order) {
  const payment = salesPaymentMeta[order.payStatus] || salesPaymentMeta.unpaid
  const contractCents = amountToCents(order.contractAmount)
  const receivedCents = amountToCents(order.receivedAmount)
  const unpaidCents = amountToCents(order.unreceivedAmount)
  const goodsSummary = order.items && order.items.length
    ? `${order.items.slice(0, 2).map(item => item.productName).join('、')}${order.items.length > 2 ? ` 等${order.items.length}条明细` : ` ${order.items.length}条明细`}`
    : '无产品明细'
  return {
    id: String(order.id),
    no: order.orderNo,
    date: formatDate(order.orderDate),
    creator: order.creatorName || '系统',
    goodsSummary,
    typeText: '销售单',
    typeTone: 'primary',
    statusText: payment.text,
    statusTone: payment.tone,
    contractText: formatAmount(contractCents),
    receivedText: formatAmount(receivedCents),
    unpaidText: formatAmount(unpaidCents),
    contractTone: 'normal',
    receivedTone: receivedCents ? 'success' : 'normal',
    unpaidTone: unpaidCents ? 'danger' : 'success',
    canReceive: ['unpaid', 'partial'].includes(order.payStatus) && unpaidCents > 0,
    actionText: ['unpaid', 'partial'].includes(order.payStatus) && unpaidCents > 0 ? '收款' : '详情'
  }
}

async function listFundRecords(app, orgId, customerId, query = {}) {
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100)
  const where = {
    orgId,
    customerId
  }
  const [total, records] = await Promise.all([
    app.prisma.fundRecord.count({ where }),
    app.prisma.fundRecord.findMany({
      where,
      include: {
        order: true
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])
  return {
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    list: records.map(formatFundRecord)
  }
}

async function listReceivableSalesOrders(prisma, orgId, customerId) {
  return prisma.salesOrder.findMany({
    where: {
      orgId,
      customerId,
      payStatus: { in: ['unpaid', 'partial'] },
      unreceivedAmount: { gt: 0 }
    },
    include: {
      items: {
        orderBy: { id: 'asc' }
      }
    },
    orderBy: [{ orderDate: 'asc' }, { orderNo: 'asc' }]
  })
}

async function calculateCustomerTotals(prisma, orgId, customerId) {
  const [customer, orders] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: customerId,
        org_id: orgId
      }
    }),
    prisma.salesOrder.findMany({
      where: {
        orgId,
        customerId
      },
      select: {
        contractAmount: true,
        receivedAmount: true,
        unreceivedAmount: true
      }
    })
  ])
  const openingDebtCents = amountToCents(customer && customer.opening_debt)
  const contractCents = orders.reduce((sum, order) => sum + amountToCents(order.contractAmount), 0)
  const paidCents = orders.reduce((sum, order) => sum + amountToCents(order.receivedAmount), 0)
  const unpaidCents = openingDebtCents + orders.reduce((sum, order) => sum + amountToCents(order.unreceivedAmount), 0)

  return {
    contractCents,
    paidCents,
    unpaidCents,
    contract_amount: centsToAmount(contractCents),
    paid_amount: centsToAmount(paidCents),
    unpaid_amount: centsToAmount(unpaidCents)
  }
}

async function syncCustomerTotals(prisma, orgId, customerId, extraData = {}) {
  const totals = await calculateCustomerTotals(prisma, orgId, customerId)
  return prisma.customer.update({
    where: { id: customerId },
    include: {
      customerCategory: true
    },
    data: {
      contract_amount: totals.contract_amount,
      paid_amount: totals.paid_amount,
      unpaid_amount: totals.unpaid_amount,
      ...extraData
    }
  })
}

function mapTask(task) {
  const statusMap = {
    pending: { text: '待处理', tone: 'warning' },
    parsing: { text: '解析中', tone: 'warning' },
    success: { text: '已完成', tone: 'success' },
    failed: { text: '失败', tone: 'danger' }
  }
  const meta = statusMap[task.status] || statusMap.pending
  const actionText = task.type === 'customer_export' ? '导出' : '导入'
  return {
    id: task.id,
    title: task.fileName || `客户${actionText}任务`,
    desc: task.errorText || `共 ${task.totalRows} 行，成功 ${task.successRows} 行，失败 ${task.failedRows} 行。`,
    time: formatDate(task.createdAt) || '刚刚',
    statusText: meta.text,
    statusTone: meta.tone,
    filePath: task.fileUrl || '',
    actionType: task.type === 'customer_export' ? 'export' : 'import'
  }
}

function parseCsv(content) {
  const text = String(content || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  row.push(field)
  if (row.some(value => String(value || '').trim())) rows.push(row)
  if (!rows.length) return []

  const headers = rows[0].map(header => normalizeKeyword(header))
  return rows.slice(1)
    .filter(values => values.some(value => normalizeKeyword(value)))
    .map((values, index) => {
      const record = { __rowNo: index + 2 }
      headers.forEach((header, headerIndex) => {
        if (header) record[header] = normalizeKeyword(values[headerIndex])
      })
      return record
    })
}

async function parseExcelBase64(contentBase64) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(String(contentBase64 || ''), 'base64'))
  const sheet = workbook.worksheets[0]
  if (!sheet) return []
  const matrix = []
  sheet.eachRow({ includeEmpty: false }, row => {
    matrix.push(row.values.slice(1).map(value => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'object' && value.text) return value.text
      if (typeof value === 'object' && value.result !== undefined) return value.result
      return String(value)
    }))
  })
  if (!matrix.length) return []
  const headers = matrix[0].map(header => normalizeKeyword(header))
  return matrix.slice(1)
    .filter(values => values.some(value => normalizeKeyword(value)))
    .map((values, index) => {
      const record = { __rowNo: index + 2 }
      headers.forEach((header, headerIndex) => {
        if (header) record[header] = normalizeKeyword(values[headerIndex])
      })
      return record
    })
}

function escapeCsv(value) {
  return `"${String(value === null || value === undefined ? '' : value).replace(/"/g, '""')}"`
}

function buildCustomerCsv(customers) {
  const columns = [
    ['ID', 'id'],
    ['组织ID', 'org_id'],
    ['客户分类ID', 'customer_category_id'],
    ['客户名称', 'customer_name'],
    ['客户分类', 'customer_category'],
    ['电话', 'phone'],
    ['备用电话', 'backup_phone'],
    ['传真', 'fax'],
    ['省份', 'province'],
    ['城市', 'city'],
    ['区县', 'district'],
    ['详细地址', 'detail_address'],
    ['地址备注', 'address_remark'],
    ['邮编', 'zipcode'],
    ['期初欠款', 'opening_debt'],
    ['合同金额', 'contract_amount'],
    ['已收金额', 'paid_amount'],
    ['未收金额', 'unpaid_amount'],
    ['预收金额', 'prepaid_amount'],
    ['备注', 'remark']
  ]
  const rows = customers.map(customer => columns.map(([, key]) => escapeCsv(customer[key])).join(','))
  return `\uFEFF${columns.map(([label]) => label).join(',')}\n${rows.join('\n')}`
}

function normalizeImportRow(row) {
  const get = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== '') return row[key]
    }
    return ''
  }

  return {
    customer_name: get('customer_name', '客户名称', '名称'),
    customer_category_id: get('customer_category_id', '客户分类ID'),
    customer_category: get('customer_category', '客户分类', '分类') || '普通客户',
    phone: get('phone', '电话', '联系电话', '手机号'),
    backup_phone: get('backup_phone', '备用电话'),
    fax: get('fax', '传真'),
    remark: get('remark', '备注'),
    address_short: get('address_short', '地址简称'),
    province: get('province', '省份', '省'),
    city: get('city', '城市', '市'),
    district: get('district', '区县', '区'),
    detail_address: get('detail_address', '详细地址', '地址'),
    address_remark: get('address_remark', '地址备注'),
    zipcode: get('zipcode', '邮编'),
    opening_debt: get('opening_debt', '期初欠款'),
    contract_amount: get('contract_amount', '合同金额'),
    delivered_amount: get('delivered_amount', '发货金额'),
    prepaid_amount: get('prepaid_amount', '预收金额'),
    unpaid_amount: get('unpaid_amount', '未收金额'),
    paid_amount: get('paid_amount', '已收金额'),
    source_file: get('source_file', '来源文件'),
    source_sheet: get('source_sheet', '来源Sheet'),
    source_row_no: row.__rowNo || 0
  }
}

async function ensureImportCategory(prisma, orgId, payload) {
  if (payload.customer_category_id) return payload
  const categoryName = normalizeKeyword(payload.customer_category || payload.category)
  if (!categoryName) return payload
  const category = await prisma.customerCategory.upsert({
    where: {
      org_id_name: {
        org_id: orgId,
        name: categoryName
      }
    },
    update: {
      is_active: true
    },
    create: {
      org_id: orgId,
      name: categoryName
    }
  })
  return {
    ...payload,
    customer_category_id: category.id,
    customer_category: category.name
  }
}

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

async function ensureDefaultAccount(prisma, orgId) {
  const existing = await prisma.account.findFirst({
    where: {
      orgId,
      status: 'enabled'
    },
    orderBy: { createdAt: 'asc' }
  })
  if (existing) return existing

  return prisma.account.create({
    data: {
      orgId,
      accountName: '默认收款账户',
      initBalance: '0.00',
      currentBalance: '0.00',
      remark: '系统自动创建，用于本地开发和未配置账户时的默认收款。'
    }
  })
}

function makeReceiptNo() {
  const date = new Date()
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return `SK${ymd}${String(Date.now()).slice(-8)}`
}

function buildCustomerWhere(orgId, query = {}) {
  const keyword = normalizeKeyword(query.keyword)
  const where = {
    org_id: orgId,
    is_active: true
  }
  if (query.category) where.customer_category = query.category
  if (query.categoryId) where.customer_category_id = query.categoryId
  if (query.balanceState === 'receivable') where.unpaid_amount = { gt: 0 }
  if (query.balanceState === 'prepaid') where.prepaid_amount = { gt: 0 }
  if (query.balanceState === 'settled') {
    where.unpaid_amount = 0
    where.prepaid_amount = 0
  }
  if (query.area) {
    if (query.area === '未分区') {
      where.OR = [
        { province: null },
        { province: '' }
      ]
    } else {
      where.OR = [
        { province: { contains: query.area, mode: 'insensitive' } },
        { city: { contains: query.area, mode: 'insensitive' } },
        { district: { contains: query.area, mode: 'insensitive' } },
        { detail_address: { contains: query.area, mode: 'insensitive' } }
      ]
    }
  }
  if (keyword) {
    const keywordOr = [
      { customer_name: { contains: keyword, mode: 'insensitive' } },
      { customer_name_normalized: { contains: normalizeName(keyword), mode: 'insensitive' } },
      { customer_name_pinyin: { contains: keyword, mode: 'insensitive' } },
      { customer_name_initials: { contains: keyword, mode: 'insensitive' } },
      { phone: { contains: keyword, mode: 'insensitive' } },
      { backup_phone: { contains: keyword, mode: 'insensitive' } },
      { detail_address: { contains: keyword, mode: 'insensitive' } },
      { address_short: { contains: keyword, mode: 'insensitive' } }
    ]
    where.AND = [{ OR: keywordOr }]
  }
  return where
}

function buildOrderBy(sortKey) {
  if (sortKey === 'receivableDesc') return [{ unpaid_amount: 'desc' }, { updated_at: 'desc' }]
  if (sortKey === 'contractDesc') return [{ contract_amount: 'desc' }, { updated_at: 'desc' }]
  if (sortKey === 'nameAsc') return [{ customer_name: 'asc' }]
  if (sortKey === 'dateAsc') return [{ updated_at: 'asc' }]
  return [{ updated_at: 'desc' }]
}

function buildCustomerData(payload, orgId, options = {}) {
  const name = normalizeKeyword(payload.customer_name || payload.name)
  const explicitUnpaidValue = firstPayloadValue(payload, ['unpaid_amount', 'receivableCents'])
  const hasExplicitUnpaidAmount = explicitUnpaidValue !== undefined && normalizeKeyword(explicitUnpaidValue) !== ''
  const data = {
    customer_name: name,
    customer_category_id: normalizeKeyword(payload.customer_category_id || payload.categoryId) || null,
    customer_category: normalizeKeyword(payload.customer_category || payload.category || payload.tag || '普通客户'),
    phone: normalizeKeyword(payload.phone),
    backup_phone: normalizeKeyword(payload.backup_phone || payload.backupPhone),
    fax: normalizeKeyword(payload.fax),
    remark: normalizeKeyword(payload.remark),
    address_short: normalizeKeyword(payload.address_short || payload.addressShort || payload.address),
    province: normalizeKeyword(payload.province || payload.area),
    city: normalizeKeyword(payload.city),
    district: normalizeKeyword(payload.district),
    detail_address: normalizeKeyword(payload.detail_address || payload.detailAddress || payload.address),
    address_remark: normalizeKeyword(payload.address_remark || payload.addressRemark),
    zipcode: normalizeKeyword(payload.zipcode),
    opening_debt: parseAmount(payload, 'opening_debt', 'openingDebtCents', parseAmount(payload, 'openingReceivable', 'openingReceivableCents')),
    contract_amount: parseAmount(payload, 'contract_amount', 'contractCents'),
    delivered_amount: parseAmount(payload, 'delivered_amount', 'deliveredCents'),
    prepaid_amount: parseAmount(payload, 'prepaid_amount', 'prepaidCents'),
    unpaid_amount: parseAmount(payload, 'unpaid_amount', 'receivableCents'),
    paid_amount: parseAmount(payload, 'paid_amount', 'receivedCents'),
    is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
    source_file: normalizeKeyword(payload.source_file || payload.sourceFile || 'manual'),
    source_sheet: normalizeKeyword(payload.source_sheet || payload.sourceSheet || ''),
    source_row_no: Number(payload.source_row_no || payload.sourceRowNo || 0),
    customer_name_normalized: normalizeName(name),
    customer_name_pinyin: normalizeKeyword(payload.customer_name_pinyin || payload.customerNamePinyin),
    customer_name_initials: normalizeKeyword(payload.customer_name_initials || payload.customerNameInitials)
  }

  if (!options.partial && !hasExplicitUnpaidAmount && amountToCents(data.opening_debt) > 0) {
    data.unpaid_amount = data.opening_debt
  }

  if (!options.partial) data.org_id = orgId

  Object.keys(data).forEach(key => {
    if (options.partial && (data[key] === '' || data[key] === undefined || data[key] === null)) delete data[key]
  })

  return data
}

async function findCustomer(app, orgId, id) {
  if (!/^\d+$/.test(String(id || ''))) return null
  return app.prisma.customer.findFirst({
    where: {
      id: BigInt(id),
      org_id: orgId,
      is_active: true
    },
    include: {
      customerCategory: true
    }
  })
}

async function customerRoutes(app) {
  app.get('/fund-records/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const record = await app.prisma.fundRecord.findFirst({
      where: {
        id: request.params.id,
        orgId
      },
      include: {
        customer: {
          include: {
            customerCategory: true
          }
        },
        order: true
      }
    })
    if (!record) {
      reply.code(404)
      return fail('资金流水不存在', { code: 404, traceId: request.id })
    }
    return ok(buildFundDetail(record), request.id)
  })

  app.get('/customers/summary', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customers = await app.prisma.customer.findMany({
      where: {
        org_id: orgId,
        is_active: true
      },
      select: {
        unpaid_amount: true,
        prepaid_amount: true
      }
    })
    const receivableCents = customers.reduce((sum, customer) => sum + amountToCents(customer.unpaid_amount), 0)
    const prepaidCents = customers.reduce((sum, customer) => sum + amountToCents(customer.prepaid_amount), 0)
    const receivableCount = customers.filter(customer => amountToCents(customer.unpaid_amount) > 0).length

    return ok({
      title: '',
      metrics: [
        { key: 'receivableCustomers', label: '欠款客户', value: `${receivableCount}位`, tone: 'danger' },
        { key: 'receivable', label: '累计欠款', value: formatCompactAmount(receivableCents), tone: receivableCents ? 'danger' : 'success' },
        { key: 'prepaid', label: '预收余额', value: formatCompactAmount(prepaidCents), tone: prepaidCents ? 'primary' : 'success' }
      ]
    }, request.id)
  })

  app.get('/customers/import-export', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const [total, tasks] = await Promise.all([
      app.prisma.customer.count({ where: { org_id: orgId, is_active: true } }),
      app.prisma.importExportTask.findMany({
        where: {
          orgId,
          type: { in: ['customer_import', 'customer_export'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])
    return ok({
      importTitle: '客户批量导入',
      importDesc: '请使用 CSV 模板导入，后端会解析、校验并直接写入客户真实表。',
      exportTitle: '客户批量导出',
      exportDesc: `当前真实客户表共有 ${total} 位客户，可导出 Excel 可打开的 CSV 对账文件。`,
      importHint: '字段以 customers 表为准，模板已提供中文表头和后端字段映射。',
      tasks: tasks.map(mapTask)
    }, request.id)
  })

  app.get('/customers/import-template', async request => {
    const headers = ['客户名称', '客户分类', '电话', '备用电话', '传真', '省份', '城市', '区县', '详细地址', '期初欠款', '预收金额', '备注']
    const demo = ['示例客户', '普通客户', '13800138000', '', '', '贵州', '贵阳', '南明区', '示例街道 1 号', '0.00', '0.00', '模板示例，导入前可删除']
    return ok({
      fileName: '客户导入模板.csv',
      content: `\uFEFF${headers.join(',')}\n${demo.map(escapeCsv).join(',')}\n`
    }, request.id)
  })

  app.get('/customers/export', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customers = await app.prisma.customer.findMany({
      where: buildCustomerWhere(orgId, request.query || {}),
      orderBy: buildOrderBy(request.query && request.query.sortKey)
    })
    const fileName = `customers-${Date.now()}.csv`
    await app.prisma.importExportTask.create({
      data: {
        orgId,
        type: 'customer_export',
        status: 'success',
        fileName,
        totalRows: customers.length,
        successRows: customers.length
      }
    })
    return ok({
      fileName,
      content: buildCustomerCsv(customers),
      totalRows: customers.length,
      successRows: customers.length,
      failedRows: 0
    }, request.id)
  })

  app.get('/customers/import-tasks/:taskId', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const task = await app.prisma.importExportTask.findFirst({
      where: {
        id: request.params.taskId,
        orgId
      }
    })
    return ok(task ? mapTask(task) : null, request.id)
  })

  app.post('/customers/import-tasks', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const fileName = normalizeKeyword(payload.fileName || payload.title || '客户导入.csv')
    const content = String(payload.content || '')
    const extension = normalizeKeyword(payload.fileType || fileName.split('.').pop()).toLowerCase()
    const task = await app.prisma.importExportTask.create({
      data: {
        orgId,
        type: 'customer_import',
        status: 'parsing',
        fileName
      }
    })

    if (!['csv', 'xlsx'].includes(extension) || !content) {
      const failed = await app.prisma.importExportTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorText: content ? '仅支持 CSV、XLSX 客户文件，老 XLS 请先另存为 XLSX 或 CSV' : '导入文件内容为空'
        }
      })
      return ok(mapTask(failed), request.id)
    }

    const rows = extension === 'csv' ? parseCsv(content) : await parseExcelBase64(content)
    let successRows = 0
    const failures = []
    for (const row of rows) {
      const importPayload = await ensureImportCategory(app.prisma, orgId, {
        ...normalizeImportRow(row),
        source_file: fileName
      })
      const validation = await validateCustomerPayload(app.prisma, orgId, importPayload)
      if (validation.errors.length) {
        failures.push(`第${row.__rowNo}行：${validation.errors[0]}`)
        continue
      }
      const data = buildCustomerData(validation.payload, orgId)
      const existing = data.phone
        ? await app.prisma.customer.findFirst({ where: { org_id: orgId, phone: data.phone, is_active: true } })
        : await app.prisma.customer.findFirst({ where: { org_id: orgId, customer_name: data.customer_name, is_active: true } })
      if (existing) {
        const updateData = { ...data }
        delete updateData.org_id
        await app.prisma.customer.update({
          where: { id: existing.id },
          data: updateData
        })
      } else {
        await app.prisma.customer.create({ data })
      }
      successRows += 1
    }

    const finished = await app.prisma.importExportTask.update({
      where: { id: task.id },
      data: {
        status: failures.length ? (successRows ? 'success' : 'failed') : 'success',
        totalRows: rows.length,
        successRows,
        failedRows: failures.length,
        errorText: failures.slice(0, 5).join('；')
      }
    })
    return ok(mapTask(finished), request.id)
  })

  app.put('/customers/import-tasks/:taskId', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const existing = await app.prisma.importExportTask.findFirst({
      where: {
        id: request.params.taskId,
        orgId
      }
    })
    if (!existing) return ok(null, request.id)
    const payload = request.body || {}
    const updated = await app.prisma.importExportTask.update({
      where: { id: existing.id },
      data: {
        status: payload.status || existing.status,
        fileName: payload.fileName || existing.fileName,
        fileUrl: payload.fileUrl || existing.fileUrl,
        errorText: payload.errorText || existing.errorText
      }
    })
    return ok(mapTask(updated), request.id)
  })

  app.get('/customers', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const page = Math.max(Number(query.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize || query.limit || 20), 1), 100)
    const where = buildCustomerWhere(orgId, query)
    const [total, customers] = await Promise.all([
      app.prisma.customer.count({ where }),
      app.prisma.customer.findMany({
        where,
        include: {
          customerCategory: true
        },
        orderBy: buildOrderBy(query.sortKey),
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])
    const list = customers.map(buildCustomerDto).filter(customer => {
      if (query.balanceState && customer.statusKey !== query.balanceState) return false
      if (query.level && customer.level !== query.level) return false
      if (query.activityState && customer.activeState !== query.activityState) return false
      return true
    })

    return ok({
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      list
    }, request.id)
  })

  app.post('/customers', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const validation = await validateCustomerPayload(app.prisma, orgId, payload)
    if (validation.errors.length) {
      reply.code(400)
      return fail(validation.errors[0], { code: 400, data: { errors: validation.errors }, traceId: request.id })
    }
    const data = buildCustomerData(validation.payload, orgId)
    const customer = await app.prisma.customer.create({
      data,
      include: {
        customerCategory: true
      }
    })
    return ok(buildCustomerForm(customer), request.id)
  })

  app.get('/customers/:id/sales-orders', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) return ok({ page: 1, pageSize: 20, total: 0, hasMore: false, list: [] }, request.id)
    const query = request.query || {}
    const page = Math.max(Number(query.page || 1), 1)
    const pageSize = Math.max(Number(query.pageSize || 20), 1)
    const where = {
      orgId,
      customerId: customer.id
    }
    const [total, orders] = await Promise.all([
      app.prisma.salesOrder.count({ where }),
      app.prisma.salesOrder.findMany({
        where,
        include: {
          items: {
            orderBy: { id: 'asc' }
          }
        },
        orderBy: [{ orderDate: 'desc' }, { orderNo: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])
    return ok({
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      list: orders.map(formatCustomerSalesOrder)
    }, request.id)
  })

  app.get('/customers/:id/fund-records', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) return ok({ page: 1, pageSize: 20, total: 0, hasMore: false, list: [] }, request.id)
    return ok(await listFundRecords(app, orgId, customer.id, request.query || {}), request.id)
  })

  app.get('/customers/:id/receipt-context', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) {
      reply.code(404)
      return fail('客户不存在', { code: 404, traceId: request.id })
    }
    const receivableOrders = await listReceivableSalesOrders(app.prisma, orgId, customer.id)
    return ok(buildReceipt(customer, request.query && request.query.amountCents, request.query || {}, receivableOrders), request.id)
  })

  app.post('/customers/:id/receipts', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) {
      reply.code(404)
      return fail('客户不存在', { code: 404, traceId: request.id })
    }

	  const payload = request.body || {}
    if (normalizeKeyword(payload.remark).length > 120) {
      reply.code(400)
      return fail('备注不能超过120字', { code: 400, traceId: request.id })
    }
	  const amountCents = Number(payload.amountCents || 0)
	  const usePrepaidCents = Number(payload.usePrepaidCents || 0)
	  const currentPrepaidCents = amountToCents(customer.prepaid_amount)
	  if (!Number.isFinite(amountCents) || amountCents < 0) {
	    reply.code(400)
	    return fail('请输入有效收款金额', { code: 400, traceId: request.id })
	  }
	  if (payload.prepayMode && amountCents <= 0) {
	    reply.code(400)
	    return fail('请输入预收金额', { code: 400, traceId: request.id })
	  }
	  if (!payload.prepayMode && amountCents <= 0 && usePrepaidCents <= 0) {
	    reply.code(400)
	    return fail('请输入收款金额或使用预收款', { code: 400, traceId: request.id })
	  }
	  if (!Number.isFinite(usePrepaidCents) || usePrepaidCents < 0 || usePrepaidCents > currentPrepaidCents) {
	    reply.code(400)
	    return fail('使用预收款不能大于客户预收余额', { code: 400, traceId: request.id })
	  }

	  const account = payload.accountId
	    ? await app.prisma.account.findFirst({
          where: {
            id: String(payload.accountId),
            orgId,
            status: 'enabled'
          }
        })
      : await ensureDefaultAccount(app.prisma, orgId)
    if (!account) {
      reply.code(400)
      return fail('收款账户不存在或已停用', { code: 400, traceId: request.id })
    }

	  const receiptNo = makeReceiptNo()
	  const receiptAmount = centsToAmount(amountCents)
	  const receiptDate = payload.date ? new Date(payload.date) : new Date()

	  const [updated, receiptOrder, allocationResult] = await app.prisma.$transaction(async tx => {
	    const receivableOrders = await listReceivableSalesOrders(tx, orgId, customer.id)
	    const totalOrderUnpaidCents = receivableOrders.reduce((sum, order) => sum + amountToCents(order.unreceivedAmount), 0)
	    const actualUsePrepaidCents = payload.prepayMode ? 0 : Math.min(usePrepaidCents, currentPrepaidCents, totalOrderUnpaidCents)
	    const cashAllocatedCents = payload.prepayMode ? 0 : Math.min(amountCents, Math.max(totalOrderUnpaidCents - actualUsePrepaidCents, 0))
	    const overpaidCents = payload.prepayMode ? amountCents : Math.max(amountCents - cashAllocatedCents, 0)
	    const distributionCents = actualUsePrepaidCents + cashAllocatedCents
	    if (!payload.prepayMode && distributionCents <= 0 && overpaidCents <= 0) {
	      throw new Error('请输入收款金额或使用预收款')
	    }
	    let remaining = distributionCents
	    const allocations = []
	    for (const order of receivableOrders) {
	      if (remaining <= 0) break
	      const orderUnpaidCents = amountToCents(order.unreceivedAmount)
	      const allocatedCents = Math.min(orderUnpaidCents, remaining)
	      if (allocatedCents <= 0) continue
	      const beforeReceivedCents = amountToCents(order.receivedAmount)
	      const beforeUnreceivedCents = amountToCents(order.unreceivedAmount)
	      const nextReceivedCents = beforeReceivedCents + allocatedCents
	      const nextUnreceivedCents = Math.max(amountToCents(order.contractAmount) - nextReceivedCents, 0)
	      await tx.salesOrder.update({
	        where: { id: order.id },
	        data: {
	          receivedAmount: centsToAmount(nextReceivedCents),
	          unreceivedAmount: centsToAmount(nextUnreceivedCents),
	          payStatus: getPaymentState(amountToCents(order.contractAmount), nextReceivedCents)
	        }
	      })
	      allocations.push({
	        order,
	        allocatedCents,
	        beforeReceivedCents,
	        beforeUnreceivedCents,
	        nextUnreceivedCents
	      })
	      remaining -= allocatedCents
	    }
	    const nextPrepaidCents = Math.max(currentPrepaidCents - actualUsePrepaidCents + overpaidCents, 0)
	    await tx.account.update({
	      where: { id: account.id },
	      data: {
          currentBalance: {
            increment: receiptAmount
	        }
	      }
	    })
	    const order = await tx.receiptOrder.create({
        data: {
          orgId,
          receiptNo,
          customerId: customer.id,
          receiptDate,
          accountId: account.id,
          accountNameSnapshot: account.accountName,
          receiptAmount,
          prepayMode: Boolean(payload.prepayMode),
          creatorUserId: payload.creatorUserId || null,
          remark: payload.remark || ''
	        }
	      })
	      for (const allocation of allocations) {
	        await tx.receiptOrderItem.create({
	          data: {
	            orgId,
	            receiptId: order.id,
	            salesOrderId: allocation.order.id,
	            contractAmount: String(allocation.order.contractAmount || '0'),
	            receivedAmountBefore: centsToAmount(allocation.beforeReceivedCents),
	            unreceivedAmountBefore: centsToAmount(allocation.beforeUnreceivedCents),
	            currentReceiveAmount: centsToAmount(allocation.allocatedCents)
	          }
	        })
	      }
	    const syncedCustomer = await syncCustomerTotals(tx, orgId, customer.id, {
	      prepaid_amount: centsToAmount(nextPrepaidCents)
	    })
	    const balanceCents = nextPrepaidCents - amountToCents(syncedCustomer.unpaid_amount)
	    for (const allocation of allocations) {
	      await tx.fundRecord.create({
	        data: {
	          orgId,
	          customerId: customer.id,
	          orderId: allocation.order.id,
	          type: actualUsePrepaidCents > 0 && amountCents === 0 ? 'prepayment_offset' : 'customer_receipt',
	          amountCents: allocation.allocatedCents,
	          balanceCents,
	          occurredAt: receiptDate,
	          note: `${receiptNo} 分摊至销售单 ${allocation.order.orderNo} ${payload.remark || ''}`.trim()
	        }
	      })
	    }
	    if (overpaidCents > 0) {
	      await tx.fundRecord.create({
	        data: {
	          orgId,
	          customerId: customer.id,
	          type: 'prepayment',
	          amountCents: overpaidCents,
	          balanceCents,
	          occurredAt: receiptDate,
	          note: `${receiptNo} 超出未收金额，自动转入客户预收款。${payload.remark || ''}`.trim()
	        }
	      })
	    }
	    return [syncedCustomer, order, { actualUsePrepaidCents, cashAllocatedCents, overpaidCents, allocations }]
	  })

	  return ok({
	    ...buildReceipt(updated, amountCents, {
	      ...payload,
	      usePrepaidCents: allocationResult.actualUsePrepaidCents
	    }),
	    receiptOrder: {
	      id: receiptOrder.id,
	      receiptNo: receiptOrder.receiptNo,
	      accountId: receiptOrder.accountId,
	      accountName: receiptOrder.accountNameSnapshot,
	      receiptAmount: amountToNumber(receiptOrder.receiptAmount),
	      allocatedCount: allocationResult.allocations.length,
	      overpaidCents: allocationResult.overpaidCents
	    }
	  }, request.id)
	})

  app.get('/customers/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) {
      reply.code(404)
      return fail('客户不存在', { code: 404, traceId: request.id })
    }
    const [fundRecords, salesOrders] = await Promise.all([
      listFundRecords(app, orgId, customer.id, { page: 1, pageSize: 20 }),
      app.prisma.salesOrder.findMany({
        where: {
          orgId,
          customerId: customer.id
        },
        include: {
          items: {
            orderBy: { id: 'asc' }
          }
        },
        orderBy: [{ orderDate: 'desc' }, { orderNo: 'desc' }],
        take: 20
      })
    ])
    return ok(buildCustomerDetail(customer, salesOrders.map(formatCustomerSalesOrder), fundRecords.list), request.id)
  })

  app.put('/customers/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const existing = await findCustomer(app, orgId, request.params.id)
    if (!existing) {
      reply.code(404)
      return fail('客户不存在', { code: 404, traceId: request.id })
    }
    const validation = await validateCustomerPayload(app.prisma, orgId, request.body || {}, { partial: true })
    if (validation.errors.length) {
      reply.code(400)
      return fail(validation.errors[0], { code: 400, data: { errors: validation.errors }, traceId: request.id })
    }
    const data = buildCustomerData(validation.payload, orgId, { partial: true })
    if (!data.customer_name) delete data.customer_name
    const customer = await app.prisma.customer.update({
      where: { id: existing.id },
      data,
      include: {
        customerCategory: true
      }
    })
    return ok(buildCustomerForm(customer), request.id)
  })
}

module.exports = {
  buildCustomerDto,
  customerRoutes
}
