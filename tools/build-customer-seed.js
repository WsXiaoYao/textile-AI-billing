const fs = require('fs')
const path = require('path')

function parseJsonArray(text) {
  const start = text.indexOf('[')
  if (start < 0) throw new Error('没有找到表格 JSON 数组')
  return JSON.parse(text.slice(start))
}

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function toCents(value) {
  const text = normalizeText(value)
    .replace(/,/g, '')
    .replace(/[￥¥\s]/g, '')
  if (!text || text === '-') return 0
  const numberValue = Number(text)
  if (!Number.isFinite(numberValue)) return 0
  return Math.round(numberValue * 100)
}

function inferArea(name, category, address) {
  const locationSource = `${address} ${name}`
  if (locationSource.includes('云南')) return '云南'
  if (locationSource.includes('四川')) return '四川'
  if (locationSource.includes('重庆')) return '重庆'
  if (locationSource.includes('湖南')) return '湖南'
  if (locationSource.includes('广西')) return '广西'
  if (locationSource.includes('贵州')) return '贵州'
  if (category.includes('贵州')) return '贵州'
  if (category.includes('四川')) return '四川'
  return '未分区'
}

function mergeText(current, next) {
  if (current) return current
  return next
}

function buildCustomers(rows) {
  const customerMap = new Map()

  rows.forEach(row => {
    const name = normalizeText(row['客户名称'])
    if (!name) return

    const category = normalizeText(row['客户分类'])
    const phone = normalizeText(row['电话'])
    const address = normalizeText(row['详细地址'])
    const remark = normalizeText(row['备注'])
    const existing = customerMap.get(name)

    if (existing) {
      existing.phone = mergeText(existing.phone, phone)
      existing.category = mergeText(existing.category, category)
      existing.tag = existing.category
      existing.address = mergeText(existing.address, address)
      existing.area = inferArea(existing.name, existing.category, existing.address)
      existing.contractCents += toCents(row['合同金额'])
      existing.deliveredCents += toCents(row['已送货'])
      existing.prepaidCents += toCents(row['预收款'])
      existing.receivableCents += toCents(row['未收款'])
      existing.receivedCents += toCents(row['已收款'])
      if (remark && !existing.remark.includes(remark)) {
        existing.remark = existing.remark ? `${existing.remark}；${remark}` : remark
      }
      return
    }

    customerMap.set(name, {
      id: name,
      name,
      phone,
      category: category || '普通客户',
      tag: category || '普通客户',
      area: inferArea(name, category, address),
      address,
      level: 'normal',
      contractCents: toCents(row['合同金额']),
      deliveredCents: toCents(row['已送货']),
      prepaidCents: toCents(row['预收款']),
      receivableCents: toCents(row['未收款']),
      receivedCents: toCents(row['已收款']),
      remark
    })
  })

  return Array.from(customerMap.values())
}

function main() {
  const input = process.argv[2]
  const output = process.argv[3]

  if (!input || !output) {
    console.error('Usage: node tools/build-customer-seed.js <xlsx-cli-json> <output-js>')
    process.exit(1)
  }

  const rows = parseJsonArray(fs.readFileSync(input, 'utf8'))
  const customers = buildCustomers(rows)
  const outPath = path.resolve(output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [
      '// Generated from 客户列表20260213220354.xls. Do not edit by hand.',
      `// Total customers: ${customers.length}`,
      `module.exports = ${JSON.stringify(customers, null, 2)}`,
      ''
    ].join('\n'),
    'utf8'
  )
  console.log(`Generated ${customers.length} customers -> ${outPath}`)
}

main()
