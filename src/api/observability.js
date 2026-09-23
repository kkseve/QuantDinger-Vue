import request from '@/utils/request'

const base = '/api/observability'

function get (path, params = {}) {
  return request({ url: `${base}/${path}`, method: 'get', params })
}

export function getObservabilityPortfolios (params = {}) { return get('portfolios', params) }
export function getObservabilityPerformance (params = {}) { return get('performance', params) }
export function getObservabilityDecisions (params = {}) { return get('decisions', params) }
export function getObservabilityAlpha (params = {}) { return get('alpha', params) }
export function getObservabilityMeta (params = {}) { return get('meta', params) }
export function getObservabilityRisk (params = {}) { return get('risk', params) }
export function getObservabilityExecution (params = {}) { return get('execution', params) }
export function getObservabilityCosts (params = {}) { return get('costs', params) }
export function getObservabilityComparison (params = {}) { return get('comparison', params) }
export function getObservabilityRegimes (params = {}) { return get('regimes', params) }
export function getObservabilityAlphaRegime (params = {}) { return get('alpha-regime', params) }
export function getObservabilityShadow (params = {}) { return get('shadow', params) }
export function getObservabilitySoak (params = {}) { return get('soak', params) }
export function getObservabilityDataQuality (params = {}) { return get('data-quality', params) }
export function getObservabilityResearch (params = {}) { return get('research', params) }
export function getObservabilityTrace (eventId, params = {}) {
  return get(`traces/${encodeURIComponent(eventId || '')}`, params)
}

export default {
  getObservabilityPortfolios,
  getObservabilityPerformance,
  getObservabilityDecisions,
  getObservabilityAlpha,
  getObservabilityMeta,
  getObservabilityRisk,
  getObservabilityExecution,
  getObservabilityCosts,
  getObservabilityComparison,
  getObservabilityRegimes,
  getObservabilityAlphaRegime,
  getObservabilityShadow,
  getObservabilitySoak,
  getObservabilityDataQuality,
  getObservabilityResearch,
  getObservabilityTrace
}
