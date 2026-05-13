const { prisma } = require('../src/prisma')
const { ensureInventoryBalances } = require('../src/routes/inventory')

const defaultOrgCode = 'org-main'

async function resolveOrgId() {
  const org = await prisma.organization.upsert({
    where: { code: defaultOrgCode },
    update: {},
    create: {
      code: defaultOrgCode,
      name: '聚云掌柜'
    }
  })
  return org.id
}

async function main() {
  const orgId = await resolveOrgId()
  await ensureInventoryBalances(prisma, orgId)

  const [warehouseCount, balanceCount, ledgerCount] = await Promise.all([
    prisma.warehouse.count({ where: { orgId } }),
    prisma.inventoryBalance.count({ where: { orgId } }),
    prisma.inventoryLedger.count({ where: { orgId } })
  ])

  console.log('[setup-inventory-db] ok', JSON.stringify({
    orgId,
    warehouses: warehouseCount,
    inventoryBalances: balanceCount,
    inventoryLedgers: ledgerCount
  }))
}

main()
  .catch(error => {
    console.error('[setup-inventory-db] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
