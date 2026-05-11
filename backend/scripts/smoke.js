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
  const customers = await request(app, 'GET', '/api/v1/customers?page=1&pageSize=2')
  const products = await request(app, 'GET', '/api/v1/products?page=1&pageSize=2')
  const orders = await request(app, 'GET', '/api/v1/sales-orders?page=1&pageSize=2')
  const inventory = await request(app, 'GET', '/api/v1/inventory?page=1&pageSize=2')
  const auth = await request(app, 'POST', '/api/v1/auth/wechat-phone-login', {
    phoneCode: '1358270496',
    loginCode: 'smoke'
  })
  const me = await request(app, 'GET', '/api/v1/auth/me', null, {
    authorization: `Bearer ${auth.token}`
  })
  await request(app, 'POST', '/api/v1/auth/logout', null, {
    authorization: `Bearer ${auth.token}`
  })

  await app.close()

  console.log('[backend-smoke] ok', JSON.stringify({
    db: health.database,
    customers: customers.list.length,
    products: products.list.length,
    orders: orders.list.length,
    inventory: inventory.list.length,
    authUser: me.user.phone
  }))
}

main().catch(error => {
  console.error('[backend-smoke] failed')
  console.error(error)
  process.exit(1)
})
