const { buildApp } = require('../src/app')

async function request(app, method, url, payload, headers = {}) {
  const response = await app.inject({
    method,
    url,
    payload,
    headers
  })

  const body = response.json()
  if (response.statusCode < 200 || response.statusCode >= 300 || body.code !== 0) {
    throw new Error(`${method} ${url} failed: ${response.statusCode} ${JSON.stringify(body)}`)
  }

  return body.data
}

async function main() {
  const app = buildApp({ logger: false })
  await app.ready()

  const health = await request(app, 'GET', '/health')
  const auth = await request(app, 'POST', '/api/v1/auth/wechat-phone-login', {
    mockPhone: '1358270496',
    loginCode: 'smoke'
  })
  const authHeaders = { authorization: `Bearer ${auth.token}` }
  const customers = await request(app, 'GET', '/api/v1/customers?page=1&pageSize=2', null, authHeaders)
  const orders = await request(app, 'GET', '/api/v1/sales-orders?page=1&pageSize=2', null, authHeaders)
  const customerCategories = await request(app, 'GET', '/api/v1/customer-categories?page=1&pageSize=2', null, authHeaders)
  const accounts = await request(app, 'GET', '/api/v1/accounts', null, authHeaders)
  const suppliers = await request(app, 'GET', '/api/v1/suppliers', null, authHeaders)
  const purchaseOrders = await request(app, 'GET', '/api/v1/purchase-orders', null, authHeaders)
  const returnOrders = await request(app, 'GET', '/api/v1/return-orders', null, authHeaders)
  const warehouses = await request(app, 'GET', '/api/v1/warehouses', null, authHeaders)
  const inventory = await request(app, 'GET', '/api/v1/inventory?statusKey=low', null, authHeaders)
  const inventorySummary = await request(app, 'GET', '/api/v1/inventory/summary', null, authHeaders)
  const me = await request(app, 'GET', '/api/v1/auth/me', null, {
    authorization: `Bearer ${auth.token}`
  })
  await request(app, 'POST', '/api/v1/auth/logout', null, authHeaders)

  await app.close()

  console.log('[backend-smoke] ok', JSON.stringify({
    db: health.database,
    customers: customers.list.length,
    orders: orders.list.length,
    customerCategories: customerCategories.list.length,
    accounts: accounts.list.length,
    suppliers: suppliers.list.length,
    purchaseOrders: purchaseOrders.list.length,
    returnOrders: returnOrders.list.length,
    warehouses: warehouses.length,
    inventory: inventory.list.length,
    inventoryTotal: inventorySummary.itemCount,
    authUser: me.user.phone
  }))
}

main().catch(error => {
  console.error('[backend-smoke] failed')
  console.error(error)
  process.exit(1)
})
