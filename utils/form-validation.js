function trimText(value) {
  return String(value || '').trim()
}

function digitsOnly(value, maxLength) {
  const digits = String(value || '').replace(/\D/g, '')
  return maxLength ? digits.slice(0, maxLength) : digits
}

function normalizeDecimalInput(value, options = {}) {
  const maxDecimal = options.maxDecimal === undefined ? 2 : Number(options.maxDecimal)
  const allowNegative = Boolean(options.allowNegative)
  let text = String(value || '').replace(allowNegative ? /[^\d.-]/g : /[^\d.]/g, '')
  if (allowNegative) {
    const negative = text.startsWith('-')
    text = text.replace(/-/g, '')
    if (negative) text = `-${text}`
  }
  const parts = text.split('.')
  if (parts.length > 1) {
    text = `${parts[0]}.${parts.slice(1).join('').slice(0, maxDecimal)}`
  }
  return text
}

function isMobilePhone(value) {
  return /^1\d{10}$/.test(String(value || ''))
}

function isNonNegativeAmount(value, options = {}) {
  const text = trimText(value)
  if (!text) return true
  const max = options.max === undefined ? 999999999.99 : Number(options.max)
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return false
  return Number(text) <= max
}

function isPositiveAmount(value, options = {}) {
  if (!isNonNegativeAmount(value, options)) return false
  return Number(value || 0) > 0
}

function isPositiveQty(value) {
  const text = trimText(value)
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return false
  return Number(text) > 0
}

function requireText(errors, label, value) {
  if (!trimText(value)) errors.push(`请输入${label}`)
}

function maxLength(errors, label, value, max) {
  if (trimText(value).length > max) errors.push(`${label}不能超过${max}字`)
}

function showFirstError(errors) {
  const message = Array.isArray(errors) ? errors.find(Boolean) : ''
  if (!message) return false
  wx.showToast({ title: message, icon: 'none' })
  return true
}

module.exports = {
  digitsOnly,
  isMobilePhone,
  isNonNegativeAmount,
  isPositiveAmount,
  isPositiveQty,
  maxLength,
  normalizeDecimalInput,
  requireText,
  showFirstError,
  trimText
}
