function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms || 0))
}

function makeRequestId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeResponse(body) {
  if (body && typeof body === 'object' && typeof body.code === 'number') {
    return {
      code: body.code,
      message: body.message || body.msg || '',
      data: body.data
    }
  }

  return {
    code: 0,
    message: 'ok',
    data: body
  }
}

function normalizePath(url) {
  const raw = String(url || '/')
  const withoutDomain = raw.replace(/^https?:\/\/[^/]+/i, '')
  const path = withoutDomain.split('?')[0].replace(/^\/api\/v\d+/, '')
  return path.startsWith('/') ? path : `/${path}`
}

function pageResult(list, params = {}) {
  const source = Array.isArray(list) ? list : []
  const page = Math.max(Number(params.page || 1), 1)
  const pageSize = Math.max(Number(params.pageSize || params.limit || source.length || 20), 1)
  const start = (page - 1) * pageSize
  const rows = source.slice(start, start + pageSize)

  return {
    page,
    pageSize,
    total: source.length,
    hasMore: start + pageSize < source.length,
    list: rows
  }
}

function toKeyword(value) {
  return String(value || '').trim().toLowerCase()
}

function filterByKeyword(list, keyword, fields) {
  const normalized = toKeyword(keyword)
  if (!normalized) return list

  return (Array.isArray(list) ? list : []).filter(item => {
    return fields.some(field => toKeyword(item[field]).includes(normalized))
  })
}

function ok(data) {
  return {
    code: 0,
    message: 'ok',
    data
  }
}

function notFound(method, path) {
  return {
    code: 404,
    message: `mock api not found: ${method} ${path}`,
    data: null
  }
}

module.exports = {
  delay,
  filterByKeyword,
  makeRequestId,
  normalizePath,
  normalizeResponse,
  notFound,
  ok,
  pageResult
}
