const api = require('../api')

async function run() {
  const orders = await api.order.listOrders({ page: 1, pageSize: 2 })
  const customers = await api.customer.listCustomers({ page: 1, pageSize: 2 })
  const products = await api.product.listProducts({ page: 1, pageSize: 2 })
  const inventory = await api.inventory.queryInventory({ page: 1, pageSize: 2 })
  const warehouses = await api.warehouse.listWarehouses({ page: 1, pageSize: 2 })
  const suppliers = await api.supplier.listSuppliers({ page: 1, pageSize: 2 })
  const purchases = await api.purchase.listPurchaseOrders({ page: 1, pageSize: 2 })
  const returns = await api.returnOrder.listReturnOrders({ page: 1, pageSize: 2 })
  const employees = await api.employee.listEmployees({ page: 1, pageSize: 2 })
  const messages = await api.message.listMessages({ filter: 'all', page: 1, pageSize: 2 })

  const order = orders.list[0]
  const customer = customers.list[0]
  const product = products.list[0]

  if (order) await api.order.getOrderDetail(order.id || order.no)
  if (customer) await api.customer.getCustomerDetail(customer.id || customer.name)
  if (product) await api.product.getProduct(product.id || product.no)

  console.log('[api-smoke-test] ok', JSON.stringify({
    orders: orders.list.length,
    customers: customers.list.length,
    products: products.list.length,
    inventory: inventory.list.length,
    warehouses: warehouses.list.length,
    suppliers: suppliers.list.length,
    purchases: purchases.list.length,
    returns: returns.list.length,
    employees: employees.list.length,
    messages: messages.list.length
  }))
}

run().catch(error => {
  console.error('[api-smoke-test] failed')
  console.error(error.stack || error.message || error)
  process.exit(1)
})
