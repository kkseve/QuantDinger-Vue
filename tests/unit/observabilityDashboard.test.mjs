import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildEquitySeries,
  buildPositionSeries,
  formatObservabilityValue,
  gateRows,
  isUnavailable,
  normalizeItems,
  unwrapObservabilityResponse
} from '../../src/utils/observability.js'

test('observability response and item normalization preserve empty states', () => {
  assert.deepEqual(unwrapObservabilityResponse({ code: 1, data: { items: [] } }), { items: [] })
  assert.deepEqual(normalizeItems({ items: [] }), [])
  assert.deepEqual(normalizeItems({}), [])
  assert.equal(isUnavailable(null), true)
  assert.equal(isUnavailable(0), false)
})

test('metric formatting distinguishes zero from unavailable', () => {
  assert.equal(formatObservabilityValue(0), '0.00')
  assert.equal(formatObservabilityValue(0, { percent: true }), '0.00%')
  assert.equal(formatObservabilityValue(null), 'Unavailable / Not yet observed')
})

test('chart builders do not invent zero series', () => {
  assert.deepEqual(buildEquitySeries({ equity_curve: [] }), [])
  assert.deepEqual(buildPositionSeries([]), [])
  const points = buildPositionSeries([{ timestamp: '2026-01-01T00:00:00Z', target_position: 0, position: 0 }])
  assert.deepEqual(points, [{ timestamp: '2026-01-01T00:00:00Z', target: 0, actual: 0, exposure: 0 }])
})

test('official checker reason codes become waiting/pass rows without reimplementing the gate', () => {
  const rows = gateRows({ reason_codes: ['minimum_duration', 'shadow_diagnostics_present'], criteria: { required_artifacts: true } })
  assert.equal(rows.find(row => row.key === 'minimum_duration').status, 'WAITING')
  assert.equal(rows.find(row => row.key === 'shadow_diagnostics_present').status, 'WAITING')
  assert.equal(rows.find(row => row.key === 'required_artifacts').status, 'PASS')
})
