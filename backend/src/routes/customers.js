const { ok, fail } = require('../response')

const defaultOrgCode = 'org-main'
const today = '2026-04-28'

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

function buildReceipt(customer, amountCents, options = {}) {
  const dto = buildCustomerDto(customer)
  const totalUnpaidCents = dto.receivableCents
  const availablePrepaidCents = dto.prepaidCents
  const receiptCents = amountCents === undefined ? totalUnpaidCents : Number(amountCents || 0)
  const usePrepaid = Boolean(options.usePrepaid)
  const prepayMode = Boolean(options.prepayMode)
  const usePrepaidCents = usePrepaid ? Math.min(availablePrepaidCents, totalUnpaidCents) : 0
  const distributionCents = prepayMode ? usePrepaidCents : receiptCents + usePrepaidCents
  const afterUnpaidCents = Math.max(totalUnpaidCents - distributionCents, 0)
  const prepaidAfterCents = prepayMode
    ? availablePrepaidCents - usePrepaidCents + receiptCents
    : availablePrepaidCents - usePrepaidCents

  return {
    customer: dto,
    receiptDate: today,
    remark: prepayMode ? '客户预收款，暂不分摊销售单。' : '客户整体收款，按销售日期从旧到新自动分摊。',
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
    totalUnpaidText: formatAmount(totalUnpaidCents),
    receiptText: formatAmount(receiptCents),
    afterUnpaidText: formatAmount(afterUnpaidCents),
    availablePrepaidText: formatAmount(availablePrepaidCents),
    usePrepaidText: formatAmount(usePrepaidCents),
    prepaidAfterText: formatAmount(prepaidAfterCents),
    orderCount: totalUnpaidCents > 0 ? 1 : 0,
    allocatedCount: distributionCents > 0 && totalUnpaidCents > 0 ? 1 : 0,
    allocation: [],
    displayAllocation: [],
    previewRows: prepayMode
      ? [
          { label: '收款前累计欠款', value: formatAmount(totalUnpaidCents), tone: 'normal' },
          { label: '使用预收款', value: formatAmount(-usePrepaidCents), tone: 'primary' },
          { label: '本次转入预收款', value: formatAmount(receiptCents, { plus: true }), tone: 'success' },
          { label: '收款后累计欠款', value: formatAmount(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
          { label: '预收款余额', value: formatAmount(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
        ]
      : [
          { label: '收款前累计欠款', value: formatAmount(totalUnpaidCents), tone: 'normal' },
          { label: '本次收款', value: formatAmount(-receiptCents), tone: 'success' },
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
    no: record.id,
    orderNo: record.orderId || '客户账户',
    date,
    type: meta.text,
    orderTypeText: record.orderId ? '销售单' : '客户账户',
    orderTypeTone: record.orderId ? 'primary' : 'muted',
    flowKind: meta.flowKind,
    flowTypeText: meta.text,
    flowTypeTone: meta.tone,
    amountText: formatAmount(record.amountCents, { plus: record.amountCents > 0 }),
    amountTone: record.amountCents < 0 ? 'danger' : meta.tone,
    rule: record.note || ''
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

async function resolveOrgId(prisma, request) {
  const rawOrgId = String(request.headers['x-org-id'] || defaultOrgCode).trim() || defaultOrgCode
  const existing = await prisma.organization.findFirst({
    where: {
      OR: [
        { id: rawOrgId },
        { code: rawOrgId }
      ]
    }
  })
  if (existing) return existing.id

  const org = await prisma.organization.upsert({
    where: { code: rawOrgId },
    update: {},
    create: {
      code: rawOrgId,
      name: rawOrgId === defaultOrgCode ? '聚云掌柜' : rawOrgId
    }
  })
  return org.id
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
  const hasExplicitUnpaidAmount = hasPayloadField(payload, ['unpaid_amount', 'receivableCents'])
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
    const total = await app.prisma.customer.count({ where: { org_id: orgId, is_active: true } })
    return ok({
      importTitle: '客户批量导入',
      importDesc: '请使用后端定义的 customers 字段模板导入，导入后直接写入客户真实表。',
      exportTitle: '客户批量导出',
      exportDesc: `当前真实客户表共有 ${total} 位客户，可导出 CSV 对账。`,
      importHint: '字段以 customers.sql 为准，前端展示字段只做兼容映射。',
      tasks: []
    }, request.id)
  })

  app.get('/customers/import-template', async request => {
    const headers = [
      'customer_name',
      'customer_category',
      'phone',
      'backup_phone',
      'fax',
      'remark',
      'address_short',
      'province',
      'city',
      'district',
      'detail_address',
      'address_remark',
      'zipcode',
      'opening_debt',
      'contract_amount',
      'delivered_amount',
      'prepaid_amount',
      'unpaid_amount',
      'paid_amount'
    ]
    return ok({
      fileName: 'customer-template.csv',
      content: `${headers.join(',')}\n`
    }, request.id)
  })

  app.get('/customers/export', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customers = await app.prisma.customer.findMany({
      where: buildCustomerWhere(orgId, request.query || {}),
      orderBy: buildOrderBy(request.query && request.query.sortKey)
    })
    const headers = ['id', 'customer_name', 'customer_category', 'phone', 'province', 'city', 'district', 'detail_address', 'contract_amount', 'paid_amount', 'unpaid_amount', 'prepaid_amount', 'remark']
    const escapeCsv = value => `"${String(value === null || value === undefined ? '' : value).replace(/"/g, '""')}"`
    const rows = customers.map(customer => headers.map(key => escapeCsv(customer[key])).join(','))
    return ok({
      fileName: 'customers.csv',
      content: [headers.join(','), ...rows].join('\n')
    }, request.id)
  })

  app.get('/customers/import-tasks/:taskId', async request => {
    return ok({
      id: request.params.taskId,
      status: 'done',
      title: '真实客户表导入',
      desc: '当前版本通过后端脚本导入 customers 表，页面任务中心仅保留入口。'
    }, request.id)
  })

  app.post('/customers/import-tasks', async request => {
    return ok({
      id: `customer-import-${Date.now()}`,
      ...(request.body || {}),
      status: 'pending'
    }, request.id)
  })

  app.put('/customers/import-tasks/:taskId', async request => {
    return ok({
      id: request.params.taskId,
      ...(request.body || {})
    }, request.id)
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
    return ok({
      page: Number(request.query && request.query.page || 1),
      pageSize: Number(request.query && request.query.pageSize || 20),
      total: 0,
      hasMore: false,
      list: []
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
    return ok(buildReceipt(customer, request.query && request.query.amountCents, request.query || {}), request.id)
  })

  app.post('/customers/:id/receipts', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customer = await findCustomer(app, orgId, request.params.id)
    if (!customer) {
      reply.code(404)
      return fail('客户不存在', { code: 404, traceId: request.id })
    }

    const payload = request.body || {}
    const amountCents = Number(payload.amountCents || 0)
    const usePrepaidCents = Number(payload.usePrepaidCents || 0)
    const currentUnpaidCents = amountToCents(customer.unpaid_amount)
    const currentPaidCents = amountToCents(customer.paid_amount)
    const currentPrepaidCents = amountToCents(customer.prepaid_amount)
    const nextPrepaidCents = payload.prepayMode
      ? Math.max(currentPrepaidCents - usePrepaidCents + amountCents, 0)
      : Math.max(currentPrepaidCents - usePrepaidCents, 0)
    const nextUnpaidCents = payload.prepayMode
      ? Math.max(currentUnpaidCents - usePrepaidCents, 0)
      : Math.max(currentUnpaidCents - amountCents - usePrepaidCents, 0)
    const nextPaidCents = payload.prepayMode
      ? currentPaidCents
      : currentPaidCents + amountCents

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
    const allocationCents = payload.prepayMode ? 0 : Math.min(amountCents + usePrepaidCents, currentUnpaidCents)
    const receiptDate = payload.date ? new Date(payload.date) : new Date()

    const [updated, receiptOrder] = await app.prisma.$transaction(async tx => {
      const nextCustomer = await tx.customer.update({
        where: { id: customer.id },
        include: {
          customerCategory: true
        },
        data: {
          prepaid_amount: centsToAmount(nextPrepaidCents),
          unpaid_amount: centsToAmount(nextUnpaidCents),
          paid_amount: centsToAmount(nextPaidCents)
        }
      })
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
      if (allocationCents > 0) {
        await tx.receiptOrderItem.create({
          data: {
            orgId,
            receiptId: order.id,
            salesOrderId: null,
            contractAmount: String(customer.contract_amount || '0'),
            receivedAmountBefore: String(customer.paid_amount || '0'),
            unreceivedAmountBefore: String(customer.unpaid_amount || '0'),
            currentReceiveAmount: centsToAmount(allocationCents)
          }
        })
      }
      await tx.fundRecord.create({
        data: {
          orgId,
          customerId: customer.id,
          type: payload.prepayMode ? 'prepayment' : 'customer_receipt',
          amountCents,
          balanceCents: nextPrepaidCents - nextUnpaidCents,
          note: `${receiptNo} ${payload.remark || ''}`.trim()
        }
      })
      return [nextCustomer, order]
    })

    return ok({
      ...buildReceipt(updated, amountCents, payload),
      receiptOrder: {
        id: receiptOrder.id,
        receiptNo: receiptOrder.receiptNo,
        accountId: receiptOrder.accountId,
        accountName: receiptOrder.accountNameSnapshot,
        receiptAmount: amountToNumber(receiptOrder.receiptAmount)
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
    const fundRecords = await listFundRecords(app, orgId, customer.id, { page: 1, pageSize: 20 })
    return ok(buildCustomerDetail(customer, [], fundRecords.list), request.id)
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
