const { prisma } = require('../src/prisma')

const defaultOrgCode = 'org-main'
const defaultCategories = ['普通客户', '批发客户', '零售客户', '物流客户', '零剪客户', '未分类']

async function resolveOrg() {
  return prisma.organization.upsert({
    where: { code: defaultOrgCode },
    update: {},
    create: {
      code: defaultOrgCode,
      name: '聚云掌柜'
    }
  })
}

async function main() {
  const org = await resolveOrg()
  const rows = await prisma.customer.findMany({
    where: {
      org_id: org.id,
      is_active: true
    },
    select: {
      customer_category: true
    },
    distinct: ['customer_category']
  })
  const names = Array.from(new Set(defaultCategories.concat(rows.map(row => row.customer_category || '未分类'))))
    .map(name => String(name || '').trim())
    .filter(Boolean)

  let upserted = 0
  for (const [index, name] of names.entries()) {
    const category = await prisma.customerCategory.upsert({
      where: {
        org_id_name: {
          org_id: org.id,
          name
        }
      },
      update: {
        sort_order: index * 10
      },
      create: {
        org_id: org.id,
        name,
        sort_order: index * 10,
        is_default: name === '普通客户' || name === '未分类'
      }
    })

    await prisma.customer.updateMany({
      where: {
        org_id: org.id,
        customer_category: name
      },
      data: {
        customer_category_id: category.id
      }
    })
    upserted += 1
  }

  const linked = await prisma.customer.count({
    where: {
      org_id: org.id,
      customer_category_id: { not: null }
    }
  })

  console.log(`[seed-customer-categories] ok categories=${upserted} linkedCustomers=${linked}`)
}

main()
  .catch(error => {
    console.error('[seed-customer-categories] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
