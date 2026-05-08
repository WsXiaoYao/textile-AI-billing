function ok(data, traceId) {
  return {
    code: 0,
    message: 'ok',
    data,
    traceId
  }
}

function fail(message, options = {}) {
  return {
    code: options.code || 500,
    message: message || 'server error',
    data: options.data || null,
    traceId: options.traceId
  }
}

module.exports = {
  fail,
  ok
}
