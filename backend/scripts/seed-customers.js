const { prisma } = require('../src/prisma')
const seedCustomers = require('../../data/customer-seed')

const defaultOrgCode = 'org-main'

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function positiveCents(cents) {
  return Math.max(Number(cents || 0), 0)
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

function inferProvince(item) {
  return String(item.area || '').trim()
}

function buildData(item, orgId, index) {
  const name = String(item.name || item.id || '').trim()
  const category = String(item.category || item.tag || '普通客户').trim()
  const address = String(item.address || '').trim()

  return {
    org_id: orgId,
    customer_name: name,
    customer_category: category,
    phone: String(item.phone || '').trim(),
    backup_phone: '',
    fax: '',
    remark: String(item.remark || '').trim(),
    address_short: address.slice(0, 255),
    province: inferProvince(item),
    city: '',
    district: '',
    detail_address: address,
    address_remark: '',
    zipcode: '',
    opening_debt: centsToAmount(item.receivableCents),
    contract_amount: centsToAmount(item.contractCents),
    delivered_amount: centsToAmount(item.deliveredCents),
    prepaid_amount: centsToAmount(positiveCents(item.prepaidCents)),
    unpaid_amount: centsToAmount(item.receivableCents),
    paid_amount: centsToAmount(item.receivedCents),
    is_active: true,
    source_file: 'data/customer-seed.js',
    source_sheet: 'customer-seed',
    source_row_no: index + 1,
    customer_name_normalized: normalizeName(name),
    customer_name_pinyin: '',
    customer_name_initials: ''
  }
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { code: defaultOrgCode },
    update: {},
    create: {
      code: defaultOrgCode,
      name: '聚云掌柜'
    }
  })

  let created = 0
  let updated = 0
  for (const [index, item] of seedCustomers.entries()) {
    const data = buildData(item, org.id, index)
    if (!data.customer_name) continue

    const existing = await prisma.customer.findFirst({
      where: {
        org_id: org.id,
        customer_name: data.customer_name,
        source_file: 'data/customer-seed.js'
      },
      select: { id: true }
    })

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data
      })
      updated += 1
    } else {
      await prisma.customer.create({ data })
      created += 1
    }
  }

  console.log(`[seed-customers] ok created=${created} updated=${updated} total=${seedCustomers.length}`)
}

main()
  .catch(error => {
    console.error('[seed-customers] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
