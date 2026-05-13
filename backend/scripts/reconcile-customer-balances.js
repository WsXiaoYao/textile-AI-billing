const { prisma } = require('../src/prisma')

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const customers = await prisma.customer.findMany({
    where: { is_active: true },
    select: {
      id: true,
      org_id: true,
      customer_name: true,
      opening_debt: true,
      contract_amount: true,
      paid_amount: true,
      unpaid_amount: true
    }
  })

  let changed = 0
  for (const customer of customers) {
    const orders = await prisma.salesOrder.findMany({
      where: {
        orgId: customer.org_id,
        customerId: customer.id
      },
      select: {
        contractAmount: true,
        receivedAmount: true,
        unreceivedAmount: true
      }
    })
    const contractCents = orders.reduce((sum, order) => sum + amountToCents(order.contractAmount), 0)
    const paidCents = orders.reduce((sum, order) => sum + amountToCents(order.receivedAmount), 0)
    const unpaidCents = amountToCents(customer.opening_debt) + orders.reduce((sum, order) => sum + amountToCents(order.unreceivedAmount), 0)
    const current = [
      amountToCents(customer.contract_amount),
      amountToCents(customer.paid_amount),
      amountToCents(customer.unpaid_amount)
    ].join('|')
    const next = [contractCents, paidCents, unpaidCents].join('|')
    if (current === next) continue
    changed += 1
    if (!dryRun) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          contract_amount: centsToAmount(contractCents),
          paid_amount: centsToAmount(paidCents),
          unpaid_amount: centsToAmount(unpaidCents)
        }
      })
    }
  }

  console.log(JSON.stringify({
    dryRun,
    checked: customers.length,
    changed
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
