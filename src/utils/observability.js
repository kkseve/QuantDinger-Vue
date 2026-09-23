export function unwrapObservabilityResponse (response) {
  if (!response) return null
  if (Object.prototype.hasOwnProperty.call(response, 'data')) return response.data
  return response
}

export function isUnavailable (value) {
  return value === null || value === undefined || value === '' || Number.isNaN(value)
}

export function formatObservabilityValue (value, options = {}) {
  if (isUnavailable(value)) return options.unavailable || 'Unavailable / Not yet observed'
  if (typeof value === 'number' && Number.isFinite(value)) {
    const digits = Number.isInteger(options.digits) ? options.digits : 2
    const formatted = value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    return options.percent ? `${(value * 100).toFixed(digits)}%` : formatted
  }
  return String(value)
}

export function compactHash (value) {
  const text = String(value || '')
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-8)}` : (text || 'Unavailable')
}

export function normalizeItems (payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload.items) ? payload.items : []
}

export function buildEquitySeries (performance) {
  const curve = performance && Array.isArray(performance.equity_curve) ? performance.equity_curve : []
  return curve.filter(point => point && point.timestamp && point.equity !== null && point.equity !== undefined)
}

export function buildPositionSeries (decisions) {
  const rows = Array.isArray(decisions) ? decisions : []
  return rows
    .filter(row => row && row.timestamp)
    .map(row => ({
      timestamp: row.timestamp,
      target: row.target_position === null || row.target_position === undefined ? null : Number(row.target_position),
      actual: row.position === null || row.position === undefined ? null : Number(row.position),
      exposure: row.position === null || row.position === undefined ? null : Math.abs(Number(row.position))
    }))
}

export function gateRows (checker) {
  const criteria = checker && checker.criteria ? checker.criteria : {}
  const reasons = new Set((checker && checker.reason_codes) || [])
  const labels = [
    ['minimum_duration', 'Minimum duration'],
    ['restart_recovery_drill', 'Restart recovery drill'],
    ['kill_switch_drill', 'Kill-switch drill'],
    ['pause_resume_drill', 'Pause/resume drill'],
    ['shadow_diagnostics_present', 'Shadow diagnostics'],
    ['required_artifacts', 'Required artifacts']
  ]
  return labels.map(([key, label]) => ({
    key,
    label,
    status: reasons.has(key) ? 'WAITING' : (criteria[key] === true ? 'PASS' : 'WAITING')
  }))
}

export function modeAvailable (comparison, mode) {
  const row = (Array.isArray(comparison && comparison.items) ? comparison.items : []).find(item => item.execution_mode === mode)
  return Boolean(row && row.available)
}
