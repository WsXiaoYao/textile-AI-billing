const { prisma } = require('../src/prisma')
const { applyInventoryChange } = require('../src/routes/inventory')

const defaultOrgCode = 'org-main'

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
  const draftOrders = await prisma.purchaseOrder.findMany({
    where: {
      orgId: org.id,
      state: 'draft'
    },
    include: {
      warehouse: true,
      items: true
    },
    orderBy: [{ orderDate: 'asc' }, { no: 'asc' }]
  })

  for (const order of draftOrders) {
    await prisma.$transaction(async tx => {
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { state: 'submitted' }
      })

      for (const item of order.items) {
        await applyInventoryChange(tx, {
          orgId: org.id,
          warehouseId: order.warehouseId,
          warehouseName: order.warehouse ? order.warehouse.name : '默认仓',
          productId: item.productId,
          variantId: item.variantId,
          changeQty: Number(item.quantity || 0),
          type: 'purchase_in',
          refType: 'purchase_order',
          refId: order.id,
          reason: `采购入库 ${order.no}`,
          operator: order.creator || '系统'
        })
      }
    })
  }

  const suppliers = await prisma.supplier.findMany({
    where: { orgId: org.id },
    select: { id: true }
  })
  for (const supplier of suppliers) {
    const total = await prisma.purchaseOrder.aggregate({
      where: {
        orgId: org.id,
        supplierId: supplier.id,
        state: 'submitted'
      },
      _sum: { contractCents: true }
    })
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { totalPurchaseCents: total._sum.contractCents || 0 }
    })
  }

  console.log(JSON.stringify({
    reconciledDraftPurchaseOrders: draftOrders.length,
    suppliersSynced: suppliers.length
  }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
