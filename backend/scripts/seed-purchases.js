const { prisma } = require('../src/prisma')

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function makeDate(dayOffset) {
  const date = new Date('2026-05-11T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() - dayOffset)
  return date
}

const supplierSeeds = [
  ['贵阳的织树料厂', '18334047304', '贵阳白云区货物园区 2 栋', '采购主供应商，常供辅料与寸布面料。', true],
  ['浙江双雄布业', '15185242522', '杭州柯桥区', '主营绒布和复合面料。', true],
  ['海绵辅料仓', '15685216085', '花溪产业园', '海绵、胶膜和包装辅料。', false],
  ['织锦辅料供应', '18060001122', '金阳大道', '织带、拉链和小五金供应。', false],
  ['绍兴柯桥云锦纺织', '13985012066', '绍兴柯桥轻纺城', '现货面料稳定供应。', true],
  ['广州南沙包装辅料', '13765120880', '广州南沙工业园', '包装袋、吊牌、纸箱。', false]
]

async function getOrg() {
  return prisma.organization.upsert({
    where: { code: 'org-main' },
    update: {},
    create: {
      code: 'org-main',
      name: '聚云掌柜'
    }
  })
}

async function getWarehouse(orgId) {
  const existing = await prisma.warehouse.findFirst({
    where: {
      orgId,
      status: 'enabled'
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  if (existing) return existing
  return prisma.warehouse.create({
    data: {
      orgId,
      name: '默认仓',
      isDefault: true
    }
  })
}

async function main() {
  const org = await getOrg()
  const warehouse = await getWarehouse(org.id)
  const variants = await prisma.productVariant.findMany({
    include: { product: true },
    orderBy: { id: 'asc' },
    take: 80
  })
  if (!variants.length) throw new Error('请先导入产品数据，再生成采购单种子数据')

  const suppliers = []
  for (const [name, phone, address, remark, isFrequent] of supplierSeeds) {
    const supplier = await prisma.supplier.upsert({
      where: {
        orgId_name: {
          orgId: org.id,
          name
        }
      },
      update: {
        phone,
        address,
        remark,
        isFrequent,
        status: 'enabled'
      },
      create: {
        orgId: org.id,
        name,
        phone,
        address,
        remark,
        isFrequent,
        status: 'enabled'
      }
    })
    suppliers.push(supplier)
  }

  let created = 0
  for (let index = 0; index < 36; index += 1) {
    const supplier = suppliers[index % suppliers.length]
    const orderNo = `CG202605${String(1100 + index).padStart(4, '0')}`
    const existing = await prisma.purchaseOrder.findFirst({
      where: {
        orgId: org.id,
        no: orderNo
      }
    })
    if (existing) continue

    const lineCount = 1 + (index % 3)
    const lines = []
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const variant = variants[(index * 3 + lineIndex) % variants.length]
      const quantity = 8 + ((index + lineIndex) % 9) * 3
      const basePriceCents = Math.max(amountToCents(variant.salePrice), 100)
      const unitCents = Math.max(100, Math.round(basePriceCents * (0.55 + (lineIndex * 0.08))))
      lines.push({
        variant,
        quantity,
        unitCents,
        amountCents: Math.round(quantity * unitCents)
      })
    }
    const orderCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
    const state = 'submitted'
    await prisma.$transaction(async tx => {
      const order = await tx.purchaseOrder.create({
        data: {
          orgId: org.id,
          no: orderNo,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          orderDate: makeDate(index),
          orderCents,
          contractCents: orderCents,
          state,
          creator: index % 2 === 0 ? '王姐' : '劳群',
          remark: index % 4 === 0 ? '补采购常用面料和辅料。' : ''
        }
      })
      await tx.purchaseOrderItem.createMany({
        data: lines.map(line => ({
          orderId: order.id,
          productId: line.variant.product.id,
          variantId: line.variant.id,
          productName: line.variant.product.productName,
          color: line.variant.skuValue || '默认',
          unit: line.variant.unit || line.variant.product.defaultUnit || '件',
          quantity: line.quantity.toFixed(2),
          unitCents: line.unitCents,
          amountCents: line.amountCents
        }))
      })
      if (state === 'submitted') {
        for (const line of lines) {
          await tx.productVariant.update({
            where: { id: line.variant.id },
            data: {
              openingStock: {
                increment: line.quantity.toFixed(2)
              }
            }
          })
        }
      }
    })
    created += 1
  }

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
    suppliers: suppliers.length,
    createdPurchaseOrders: created
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
