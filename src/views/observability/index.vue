<template>
  <div class="observability-page" :class="{ 'theme-dark': isDarkTheme }">
    <header class="observability-header">
      <div>
        <span class="observability-kicker">UNIFIED OBSERVABILITY</span>
        <h1>Research / Trading Dashboard</h1>
        <p>Read-only views over the existing Observability API. No trading control-plane actions are available here.</p>
      </div>
      <div class="observability-header-actions">
        <a-tag color="red">PAPER ONLY</a-tag>
        <a-tag color="orange">LIVE DISABLED</a-tag>
        <a-button icon="reload" :loading="loading" @click="loadData()">Refresh</a-button>
      </div>
    </header>

    <a-alert
      v-if="apiErrors.length"
      type="warning"
      show-icon
      class="observability-alert"
      :message="`Observability API unavailable for ${apiErrors.length} endpoint${apiErrors.length === 1 ? '' : 's'}. Showing safe empty states.`"
    />

    <section class="context-banner">
      <div class="context-heading">
        <div>
          <span class="section-kicker">CURRENT CONTEXT</span>
          <h2>{{ currentSoak && currentSoak.badge ? currentSoak.badge : 'Observability context' }}</h2>
        </div>
        <a-tag v-if="currentSoak && currentSoak.current" color="blue">CURRENT FROZEN SOAK</a-tag>
      </div>
      <div class="context-grid">
        <div class="context-item"><span>Execution mode</span><strong>{{ filters.execution_mode || 'PAPER' }}</strong></div>
        <div class="context-item"><span>Instrument</span><strong>{{ instrument }}</strong></div>
        <div class="context-item"><span>Timeframe</span><strong>{{ timeframe }}</strong></div>
        <div class="context-item"><span>Portfolio</span><strong>{{ portfolioLabel }}</strong></div>
        <div class="context-item"><span>Experiment</span><strong>{{ experimentLabel }}</strong></div>
        <div class="context-item"><span>paper_soak_id</span><strong class="mono">{{ currentSoak && currentSoak.paper_soak_id || 'Unavailable' }}</strong></div>
        <div class="context-item"><span>Soak runtime SHA</span><strong class="mono">{{ shortHash(currentSoak && currentSoak.runtime_commit) }}</strong></div>
        <div class="context-item"><span>Development HEAD</span><strong class="mono">{{ shortHash(currentSoak && currentSoak.development_head) }}</strong></div>
        <div class="context-item"><span>Bundle ID</span><strong class="mono">{{ currentSoak && currentSoak.bundle_id || 'Unavailable' }}</strong></div>
      </div>
    </section>

    <section class="filter-bar">
      <div class="filter-title"><span class="section-kicker">READ-ONLY FILTERS</span><strong>Scope the evidence without changing it</strong></div>
      <span class="timezone-note">Times shown in Asia/Tokyo (JST)</span>
      <a-select v-model="filters.execution_mode" class="filter-control" @change="applyFilters">
        <a-select-option v-for="mode in executionModes" :key="mode" :value="mode">{{ mode }}</a-select-option>
      </a-select>
      <a-select v-model="filters.range" class="filter-control" @change="applyFilters">
        <a-select-option value="full">Full run</a-select-option>
        <a-select-option value="since-soak-start">Since formal soak start</a-select-option>
        <a-select-option value="24h">24h</a-select-option>
        <a-select-option value="7d">7d</a-select-option>
        <a-select-option value="30d">30d</a-select-option>
        <a-select-option value="custom">Custom</a-select-option>
      </a-select>
      <a-input v-if="filters.range === 'custom'" v-model="filters.start" class="filter-control-wide" placeholder="Start ISO timestamp" @pressEnter="applyFilters" />
      <a-input v-if="filters.range === 'custom'" v-model="filters.end" class="filter-control-wide" placeholder="End ISO timestamp" @pressEnter="applyFilters" />
      <a-select v-model="filters.portfolio" allow-clear class="filter-control filter-control-wide" placeholder="Portfolio" @change="applyFilters">
        <a-select-option v-for="portfolio in portfolioItems" :key="portfolio.portfolio_id" :value="portfolio.portfolio_id">{{ portfolio.portfolio_id }}</a-select-option>
      </a-select>
      <a-button type="link" class="advanced-toggle" @click="advancedFiltersOpen = !advancedFiltersOpen">{{ advancedFiltersOpen ? 'Hide advanced filters' : 'Advanced filters' }}</a-button>
      <div v-if="advancedFiltersOpen" class="advanced-filters">
        <a-input v-model="filters.experiment" allow-clear class="filter-control filter-control-wide" placeholder="Experiment" @pressEnter="applyFilters" />
        <a-input v-model="filters.strategy" allow-clear class="filter-control" placeholder="Strategy" @pressEnter="applyFilters" />
        <a-input v-model="filters.alpha" allow-clear class="filter-control" placeholder="Alpha" @pressEnter="applyFilters" />
        <a-input v-model="filters.meta_version" allow-clear class="filter-control" placeholder="Meta version" @pressEnter="applyFilters" />
        <a-input v-model="filters.risk_version" allow-clear class="filter-control" placeholder="Risk version" @pressEnter="applyFilters" />
        <a-input v-model="filters.regime" allow-clear class="filter-control" placeholder="Regime" @pressEnter="applyFilters" />
        <a-input v-model="filters.instrument" allow-clear class="filter-control" placeholder="Instrument" @pressEnter="applyFilters" />
        <a-input v-model="filters.timeframe" allow-clear class="filter-control" placeholder="Timeframe" @pressEnter="applyFilters" />
      </div>
      <a-button type="primary" ghost @click="applyFilters">Apply</a-button>
      <a-button @click="resetFilters">Reset</a-button>
    </section>

    <a-spin :spinning="loading" tip="Loading observability evidence...">
      <a-tabs v-model="activeTab" type="card" class="observability-tabs">
        <a-tab-pane key="overview" tab="Overview">
          <section class="metric-grid">
            <article v-for="card in overviewCards" :key="card.key" class="metric-card" :class="`metric-card--${card.tone || 'neutral'}`">
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small v-if="card.hint">{{ card.hint }}</small>
            </article>
          </section>
          <div class="chart-grid chart-grid--wide">
            <a-card title="Equity curve" :bordered="false">
              <observation-chart :categories="equityCategories" :series="equitySeries" :empty-text="equityEmptyText" :area="true" />
            </a-card>
            <a-card title="Drawdown" :bordered="false">
              <observation-chart :categories="drawdownCategories" :series="drawdownSeries" :empty-text="'Drawdown not yet observed'" y-axis-name="drawdown" />
            </a-card>
            <a-card title="Position / exposure" :bordered="false" class="chart-grid__full">
              <observation-chart :categories="positionCategories" :series="positionSeries" :empty-text="'Position history not yet observed'" />
            </a-card>
          </div>
        </a-tab-pane>

        <a-tab-pane key="performance" tab="Performance">
          <div class="two-column-grid">
            <a-card title="Performance table" :bordered="false">
              <data-table :columns="performanceColumns" :rows="performanceRows" row-key="portfolio_id" empty-text="No performance records yet" />
            </a-card>
            <a-card title="Accounting breakdown" :bordered="false">
              <div v-if="costRows.length" class="accounting-list">
                <div v-for="row in costRows" :key="row.portfolio_id || row.execution_mode" class="accounting-row">
                  <span>{{ row.portfolio_id || row.execution_mode }}</span>
                  <strong>{{ formatMetric(row.gross) }}</strong>
                  <span class="accounting-minus">− {{ formatMetric(row.fee) }}</span>
                  <span class="accounting-minus">− {{ formatMetric(row.slippage) }}</span>
                  <span class="accounting-funding">+/- {{ formatMetric(row.funding) }}</span>
                  <strong class="accounting-net">= {{ formatMetric(row.net) }}</strong>
                  <a-tag :color="row.accounting_identity && row.accounting_identity.passed ? 'green' : 'orange'">{{ row.accounting_identity && row.accounting_identity.passed ? 'Identity OK' : 'Check identity' }}</a-tag>
                </div>
              </div>
              <empty-state v-else text="Cost evidence not yet observed" />
            </a-card>
          </div>
          <a-card title="Backtest vs forward comparison" :bordered="false" class="section-card">
            <div class="comparison-grid">
              <article v-for="row in comparisonRows" :key="row.execution_mode" class="comparison-card" :class="{ 'comparison-card--available': row.available }">
                <div class="comparison-card__head"><strong>{{ row.execution_mode }}</strong><a-tag :color="row.available ? 'green' : 'default'">{{ row.available ? 'Available' : 'Not observed' }}</a-tag></div>
                <div v-if="row.available && row.performance && row.performance.items && row.performance.items.length" class="comparison-metrics">
                  <span>Net Return <strong>{{ formatPercent(row.performance.items[0].net_return) }}</strong></span>
                  <span>Sharpe <strong>{{ formatMetric(row.performance.items[0].sharpe) }}</strong></span>
                  <span>Drawdown <strong>{{ formatPercent(row.performance.items[0].max_drawdown_pct) }}</strong></span>
                </div>
                <div v-else class="muted">No evidence for this execution mode.</div>
              </article>
            </div>
            <div class="assumption-table" v-if="assumptionRows.length">
              <div v-for="row in assumptionRows" :key="row.label"><span>{{ row.label }}</span><strong>{{ row.value || 'Unavailable' }}</strong></div>
            </div>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="signals" tab="Signals">
          <div class="chart-grid chart-grid--wide">
            <a-card title="Alpha prediction time series" :bordered="false" class="chart-grid__full">
              <observation-chart :categories="alphaCategories" :series="alphaSeries" :empty-text="'Alpha predictions not yet observed'" y-axis-name="prediction" />
            </a-card>
          </div>
          <div class="two-column-grid">
            <a-card title="Alpha signals" :bordered="false">
              <data-table :columns="alphaColumns" :rows="alphaRows" row-key="event_id" empty-text="Alpha signals not yet observed" />
            </a-card>
            <a-card title="Meta model" :bordered="false">
              <div class="detail-list">
                <div><span>Model type</span><strong>{{ metaVersion }}</strong></div>
                <div><span>Inputs</span><strong>{{ metaInputs }}</strong></div>
                <div><span>Availability</span><strong>{{ metaAvailability }}</strong></div>
                <div><span>Output</span><strong>{{ formatMetric(metaOutput) }}</strong></div>
              </div>
              <data-table :columns="metaColumns" :rows="metaRows" row-key="event_id" empty-text="Meta evidence not yet observed" />
            </a-card>
          </div>
          <a-card title="Risk transformation" :bordered="false" class="section-card">
            <data-table :columns="riskColumns" :rows="riskRows" row-key="event_id" empty-text="Risk evidence not yet observed" />
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="execution" tab="Execution">
          <div class="metric-grid metric-grid--compact">
            <article v-for="item in latencyCards" :key="item.key" class="metric-card"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></article>
          </div>
          <a-card title="Execution diagnostics" :bordered="false">
            <data-table :columns="executionColumns" :rows="executionRows" row-key="event_id" empty-text="No executions yet" />
            <div v-if="!executionRows.length" class="no-fill-callout"><a-icon type="info-circle" /> No executions yet. OrderIntent and Fill are both zero; this is a valid paper-soak state.</div>
          </a-card>
          <a-card title="Decision list" :bordered="false" class="section-card">
            <data-table :columns="decisionColumns" :rows="decisionRows" row-key="event_id" empty-text="No decisions yet">
              <template slot="actions" slot-scope="row"><a-button type="link" size="small" @click="openTrace(row.row || row)">Trace</a-button></template>
            </data-table>
          </a-card>
        </a-tab-pane>

        <a-tab-pane key="regime" tab="Regime">
          <div class="two-column-grid">
            <a-card title="Regime performance" :bordered="false"><data-table :columns="regimeColumns" :rows="regimeRows" row-key="regime" empty-text="Regime evidence not yet observed" /></a-card>
            <a-card title="Alpha × regime" :bordered="false"><data-table :columns="alphaRegimeColumns" :rows="alphaRegimeRows" row-key="key" empty-text="Alpha × regime evidence not yet observed" /></a-card>
          </div>
        </a-tab-pane>

        <a-tab-pane key="shadow" tab="Shadow">
          <a-alert v-if="!shadowRows.length" type="info" show-icon message="Shadow diagnostics not connected / no shadow events" description="No shadow evidence is converted into a fake 0% return or synthetic chart line." />
          <a-card v-else title="Shadow comparison" :bordered="false"><data-table :columns="shadowColumns" :rows="shadowRows" row-key="portfolio_id" empty-text="Shadow diagnostics not yet available" /></a-card>
        </a-tab-pane>

        <a-tab-pane key="comparison" tab="Backtest vs Forward">
          <a-card title="Execution-mode comparison" :bordered="false"><data-table :columns="comparisonColumns" :rows="comparisonTableRows" row-key="execution_mode" empty-text="No comparison records yet" /></a-card>
          <a-card title="Assumptions" :bordered="false" class="section-card"><div class="assumption-table"><div v-for="row in assumptionRows" :key="row.label"><span>{{ row.label }}</span><strong>{{ row.value || 'Unavailable' }}</strong></div></div></a-card>
        </a-tab-pane>

        <a-tab-pane key="research" tab="Research">
          <div class="research-lifecycle"><span v-for="stage in researchLifecycle" :key="stage" class="lifecycle-stage">{{ stage }}</span></div>
          <a-card title="Research catalog" :bordered="false"><data-table :columns="researchColumns" :rows="researchRows" row-key="experiment_id" empty-text="No research candidates yet" /></a-card>
          <a-card title="Hypotheses" :bordered="false" class="section-card"><data-table :columns="hypothesisColumns" :rows="hypothesisRows" row-key="hypothesis_id" empty-text="No hypotheses yet" /></a-card>
        </a-tab-pane>

        <a-tab-pane key="soak" tab="Soak Health">
          <div class="soak-header">
            <div><span class="section-kicker">GOAL 5.5</span><h2>{{ soak.status || 'NOT_STARTED' }}</h2><p>{{ formatTime(soak.formal_soak_started_at) }} → {{ formatTime(soak.last_event) }}</p></div>
            <div class="soak-progress"><strong>{{ soakProgress }}%</strong><a-progress :percent="soakProgress" :show-info="false" status="active" /><span>Elapsed {{ formatMetric(soakElapsedDays) }} / Required {{ formatMetric(soak.minimum_required_duration_days) }} days</span><small>Official checker: {{ soak.checker.result || 'Unavailable / Not yet observed' }}</small></div>
          </div>
          <a-alert
            v-if="accountingIntegrity.status === 'INVALIDATED_BY_CONFIRMED_RUNTIME_BUG'"
            type="error"
            show-icon
            class="observability-alert"
            message="Paper accounting is invalidated"
            :description="accountingIntegrity.reason || 'Review the accounting evidence before using PnL or equity for performance claims.'"
          />
          <div class="metric-grid metric-grid--compact">
            <article v-for="item in soakCounterCards" :key="item.key" class="metric-card"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></article>
          </div>
          <div class="two-column-grid">
            <a-card title="Official checker gates" :bordered="false">
              <div class="checker-result"><span>Official checker</span><strong>{{ soak.checker.result || 'Unavailable / Not yet observed' }}</strong></div>
              <div v-if="soak.checker.reason_codes && soak.checker.reason_codes.length" class="checker-reasons"><span v-for="reason in soak.checker.reason_codes" :key="reason" class="reason-chip">{{ reason }}</span></div>
              <div class="gate-list"><div v-for="gate in soakGateRows" :key="gate.key" class="gate-row"><span>{{ gate.label }}</span><a-tag :color="gate.status === 'PASS' ? 'green' : 'orange'">{{ gate.status }}</a-tag></div></div>
            </a-card>
            <a-card title="Runtime provenance" :bordered="false"><div class="detail-list"><div><span>Runtime SHA</span><strong class="mono">{{ currentSoak && currentSoak.runtime_commit || 'Unavailable' }}</strong></div><div><span>Runtime image</span><strong class="mono">{{ currentSoak && currentSoak.runtime_image || 'Unavailable' }}</strong></div><div><span>Bundle ID</span><strong class="mono">{{ currentSoak && currentSoak.bundle_id || 'Unavailable' }}</strong></div><div><span>Read-only</span><strong>{{ soak.read_only === false ? 'NO' : 'YES' }}</strong></div></div></a-card>
          </div>
          <a-card title="Reconciliation and data quality" :bordered="false" class="section-card"><div class="detail-list detail-list--grid"><div><span>Reconciliation</span><strong>{{ reconciliationLabel }}</strong></div><div><span>Accounting</span><strong>{{ accountingIntegrity.status || 'Unavailable' }}</strong></div><div><span>Position unit</span><strong>{{ accountingIntegrity.position_unit || 'Unavailable' }}</strong></div><div><span>P&L / cost unit</span><strong>{{ accountingIntegrity.pnl_unit || 'Unavailable' }}</strong></div><div><span>Freshness</span><strong>{{ quality.freshness_status || 'Unavailable' }}</strong></div><div><span>Safety violations</span><strong>{{ safetyViolations }}</strong></div><div><span>Last decision</span><strong>{{ soak.last_decision || 'Unavailable / Not yet observed' }}</strong></div></div></a-card>
        </a-tab-pane>

        <a-tab-pane key="quality" tab="Data Quality">
          <div class="metric-grid">
            <article v-for="item in qualityCards" :key="item.key" class="metric-card"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></article>
          </div>
          <a-card title="Coverage and freshness" :bordered="false"><div class="detail-list detail-list--grid"><div v-for="name in coverageNames" :key="name"><span>{{ coverageLabel(name) }}</span><strong>{{ coverageValue(name) }}</strong><small>{{ coveragePct(name) }} · {{ coverageStatus(name) }}</small></div><div><span>Funding unknown</span><strong>{{ formatMetric(quality.funding_unknown, { digits: 0 }) }}</strong></div><div><span>Last update</span><strong>{{ formatTime(quality.last_update) }}</strong></div></div></a-card>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <a-drawer :visible="traceVisible" title="Decision trace" width="min(760px, 94vw)" @close="traceVisible = false">
      <a-spin :spinning="traceLoading">
        <a-alert v-if="traceError" type="error" show-icon :message="traceError" />
        <empty-state v-else-if="trace && trace.found === false" text="Decision trace not found" />
        <div v-else-if="trace" class="trace-view">
          <div class="provenance-drawer"><span>event_id</span><strong class="mono">{{ trace.event_id }}</strong><span>decision_id</span><strong class="mono">{{ trace.decision_id || 'Unavailable' }}</strong><span>runtime</span><strong class="mono">{{ shortHash(trace.provenance && trace.provenance.runtime_commit) }}</strong></div>
          <div v-for="(stage, index) in trace.stages || []" :key="`${stage.stage}-${index}`" class="trace-stage"><div class="trace-stage__rail"><span>{{ index + 1 }}</span><i v-if="index < (trace.stages || []).length - 1"></i></div><div class="trace-stage__body"><div class="trace-stage__heading"><strong>{{ stage.stage }}</strong><a-tag :color="stageStatusColor(stage.status)">{{ stage.status || 'Unavailable' }}</a-tag></div><small>{{ formatTime(stage.timestamp) }}</small><pre>{{ pretty(stage.data) }}</pre></div></div>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ObservationChart from '@/components/Observability/ObservationChart'
import {
  getObservabilityAlpha,
  getObservabilityAlphaRegime,
  getObservabilityComparison,
  getObservabilityCosts,
  getObservabilityDataQuality,
  getObservabilityDecisions,
  getObservabilityExecution,
  getObservabilityMeta,
  getObservabilityPerformance,
  getObservabilityPortfolios,
  getObservabilityRegimes,
  getObservabilityResearch,
  getObservabilityRisk,
  getObservabilityShadow,
  getObservabilitySoak,
  getObservabilityTrace
} from '@/api/observability'
import {
  buildEquitySeries,
  buildPositionSeries,
  compactHash,
  formatObservabilityValue,
  gateRows,
  normalizeItems,
  unwrapObservabilityResponse
} from '@/utils/observability'

const emptyPayload = () => ({ items: [], count: 0 })

export default {
  name: 'ObservabilityDashboard',
  components: {
    ObservationChart,
    DataTable: {
      functional: true,
      props: ['columns', 'rows', 'rowKey', 'emptyText'],
      render (h, context) {
        const rows = context.props.rows || []
        if (!rows.length) return h('div', { class: 'inline-empty' }, context.props.emptyText || 'No data yet')
        const columns = context.props.columns || []
        const header = h('thead', [h('tr', columns.map(column => h('th', column.label)))])
        const body = rows.map((row, index) => {
          const cells = columns.map(column => {
            if (column.key === 'actions') return h('td', [context.scopedSlots.actions ? context.scopedSlots.actions({ row }) : null])
            const value = row[column.key]
            const text = column.format ? column.format(value, row) : (value === null || value === undefined || value === '' ? 'Unavailable / Not yet observed' : String(value))
            return h('td', text)
          })
          return h('tr', { key: row[context.props.rowKey || 'id'] || index }, cells)
        })
        const table = h('table', { class: 'data-table' }, [header, h('tbody', body)])
        return h('div', { class: 'data-table-wrap' }, [table])
      }
    },
    EmptyState: { functional: true, props: ['text'], render (h, context) { return h('div', { class: 'inline-empty' }, context.props.text || 'No data yet') } }
  },
  data () {
    return {
      loading: false,
      activeTab: 'overview',
      refreshTimer: null,
      advancedFiltersOpen: false,
      filters: { execution_mode: 'PAPER', range: 'full', portfolio: undefined, experiment: undefined, strategy: undefined, alpha: undefined, meta_version: undefined, risk_version: undefined, regime: undefined, instrument: undefined, timeframe: undefined, start: undefined, end: undefined },
      executionModes: ['BACKTEST', 'REPLAY', 'SHADOW', 'PAPER', 'LIVE'],
      apiErrors: [],
      portfolioPayload: emptyPayload(),
      performance: emptyPayload(),
      decisions: emptyPayload(),
      alpha: emptyPayload(),
      meta: emptyPayload(),
      risk: emptyPayload(),
      execution: emptyPayload(),
      costs: emptyPayload(),
      comparison: emptyPayload(),
      regimes: emptyPayload(),
      alphaRegime: emptyPayload(),
      shadow: emptyPayload(),
      soak: { checker: {}, identity: {} },
      quality: {},
      research: { items: [], hypotheses: [], lifecycle: [] },
      trace: null,
      traceVisible: false,
      traceLoading: false,
      traceError: ''
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () { return ['dark', 'realdark'].includes(this.navTheme) },
    currentSoak () {
      return (this.soak && this.soak.identity && Object.keys(this.soak.identity).length ? this.soak.identity : (this.performance && this.performance.current_soak)) || this.portfolioPayload.current_soak || {}
    },
    portfolioItems () { return normalizeItems(this.portfolioPayload) },
    portfolioLabel () { return this.filters.portfolio || (this.portfolioItems[0] && this.portfolioItems[0].portfolio_id) || 'All portfolios' },
    instrument () { return this.filters.instrument || this.firstProvenance.instrument || 'BTCUSDT' },
    timeframe () { return this.filters.timeframe || this.firstProvenance.timeframe || '1h' },
    experimentLabel () { return this.filters.experiment || this.firstProvenance.experiment_id || 'Unavailable / Not yet observed' },
    firstProvenance () {
      const row = this.performanceRows[0] || this.decisionRows[0] || this.alphaRows[0] || {}
      return row.provenance || {}
    },
    performanceRows () { return normalizeItems(this.performance) },
    decisionRows () { return normalizeItems(this.decisions) },
    alphaRows () { return normalizeItems(this.alpha) },
    metaRows () { return normalizeItems(this.meta) },
    riskRows () { return normalizeItems(this.risk) },
    executionRows () {
      return normalizeItems(this.execution).map(row => {
        const timing = row.timing || {}
        const intentCreated = row.intent_created === true
        const fillOccurred = row.fill_occurred === true
        return {
          ...row,
          intent_created: intentCreated,
          fill_occurred: fillOccurred,
          decision_at: timing.decision_at || timing.market_event_at,
          intent_at: intentCreated ? (timing.intent_at || timing.order_intent_at) : null,
          submitted_at: intentCreated ? timing.submitted_at : null,
          fill_at: fillOccurred ? (timing.fill_at || timing.simulated_fill_at) : null,
          slippage_bps: row.slippage_bps
        }
      })
    },
    costRows () { return normalizeItems(this.costs) },
    comparisonRows () { return normalizeItems(this.comparison) },
    regimeRows () { return normalizeItems(this.regimes) },
    alphaRegimeRows () { return normalizeItems(this.alphaRegime).map(row => ({ ...row, key: `${row.alpha}-${row.regime}` })) },
    shadowRows () { return normalizeItems(this.shadow) },
    researchRows () { return normalizeItems(this.research) },
    hypothesisRows () { return Array.isArray(this.research.hypotheses) ? this.research.hypotheses : [] },
    researchLifecycle () { return this.research.lifecycle || ['IDEA', 'DATA_BLOCKED', 'IMPLEMENTED', 'BACKTESTED', 'ROBUSTNESS_PENDING', 'REJECTED', 'PROMISING', 'NEXT_SOAK_CANDIDATE'] },
    overviewMetricRow () { return this.performanceRows[0] || {} },
    currentEquity () {
      const curve = buildEquitySeries(this.performance)
      return curve.length ? curve[curve.length - 1].equity : null
    },
    overviewCards () {
      const row = this.overviewMetricRow
      return [
        { key: 'status', label: 'Soak status', value: this.soak.status || 'NOT_STARTED', tone: this.soak.status === 'RUNNING' ? 'success' : 'warning' },
        { key: 'net', label: 'Net PnL', value: this.formatMetric(row.net_pnl) },
        { key: 'gross', label: 'Gross PnL', value: this.formatMetric(row.gross_pnl) },
        { key: 'equity', label: 'Equity', value: this.formatMetric(this.currentEquity) },
        { key: 'drawdown', label: 'Current / max drawdown', value: `${this.formatPercent(row.current_drawdown)} / ${this.formatPercent(row.max_drawdown_pct)}` },
        { key: 'position', label: 'Current position (normalized fraction)', value: this.formatMetric(this.soak.current_position) },
        { key: 'exposure', label: 'Exposure', value: this.formatPercent(row.exposure) },
        { key: 'trades', label: 'Trade count', value: this.formatMetric(row.trade_count, { digits: 0 }) },
        { key: 'decisions', label: 'Decision count', value: this.formatMetric((this.soak.event_counts || {}).model_decisions || this.decisionRows.length, { digits: 0 }) },
        { key: 'fees', label: 'Fees', value: this.formatMetric(row.fees) },
        { key: 'slippage', label: 'Slippage', value: this.formatMetric(row.slippage) },
        { key: 'funding', label: 'Funding', value: this.formatMetric(row.funding) },
        { key: 'reconciliation', label: 'Reconciliation', value: this.reconciliationLabel, tone: this.reconciliationLabel === 'OK' ? 'success' : 'warning' },
        { key: 'quality', label: 'Data quality', value: this.quality.freshness_status || 'Unavailable / Not yet observed', tone: this.quality.freshness_status === 'OK' ? 'success' : 'warning' }
      ]
    },
    equityCategories () { return buildEquitySeries(this.performance).map(item => this.shortTime(item.timestamp)) },
    equitySeries () { return [{ name: 'Paper', data: buildEquitySeries(this.performance).map(item => item.equity), color: '#2f80ed' }] },
    equityEmptyText () { return this.comparisonRows.some(item => item.execution_mode === 'PAPER' && item.available) ? 'Equity not yet observed' : 'Paper equity not yet observed' },
    drawdownCategories () { return (this.performance.drawdown_curve || []).filter(item => item && item.timestamp).map(item => this.shortTime(item.timestamp)) },
    drawdownSeries () { return [{ name: 'Drawdown', data: (this.performance.drawdown_curve || []).map(item => item.drawdown), color: '#d64545' }] },
    positionPoints () { return buildPositionSeries(this.decisionRows) },
    positionCategories () { return this.positionPoints.map(item => this.shortTime(item.timestamp)) },
    positionSeries () { return [{ name: 'TargetPosition', data: this.positionPoints.map(item => item.target), color: '#7f56d9' }, { name: 'Actual Position', data: this.positionPoints.map(item => item.actual), color: '#12b76a' }, { name: 'Exposure', data: this.positionPoints.map(item => item.exposure), color: '#f79009' }] },
    alphaCategories () { return Array.from(new Set(this.alphaRows.map(row => row.timestamp).filter(Boolean))).sort().map(value => this.shortTime(value)) },
    alphaSeries () {
      const timestamps = Array.from(new Set(this.alphaRows.map(row => row.timestamp).filter(Boolean))).sort()
      const names = Array.from(new Set(this.alphaRows.map(row => row.alpha_name).filter(Boolean)))
      const colors = ['#2f80ed', '#7f56d9', '#12b76a', '#f79009', '#d64545']
      return names.map((name, index) => ({ name, data: timestamps.map(timestamp => { const row = this.alphaRows.find(item => item.alpha_name === name && item.timestamp === timestamp); return row ? row.normalized_prediction : null }), color: colors[index % colors.length] }))
    },
    metaVersion () { return this.meta.meta_version || (this.metaRows[0] && this.metaRows[0].meta_type) || 'equal_weight/v1' },
    metaInputs () { return this.metaRows[0] && Array.isArray(this.metaRows[0].input_alpha_set) ? this.metaRows[0].input_alpha_set.join(', ') : 'Unavailable / Not yet observed' },
    metaAvailability () { return this.metaRows.length ? this.formatMetric(this.metaRows.filter(row => row.meta_output !== null && row.meta_output !== undefined).length, { digits: 0 }) : 'Unavailable / Not yet observed' },
    metaOutput () { return this.metaRows.length ? this.metaRows[this.metaRows.length - 1].meta_output : null },
    latencyCards () { const summary = this.execution.latency_summary || {}; return [{ key: 'market', label: 'Market → decision', value: this.duration(summary.market_to_decision_ms) }, { key: 'intent', label: 'Decision → intent', value: summary.intent_count === 0 ? 'Not applicable' : this.duration(summary.decision_to_intent_ms) }, { key: 'fill', label: 'Intent → fill', value: summary.fill_count === 0 ? 'Not applicable' : this.duration(summary.intent_to_fill_ms) }, { key: 'e2e', label: 'End-to-end', value: this.duration(summary.end_to_end_ms) }] },
    performanceColumns () { return [{ key: 'portfolio_id', label: 'Portfolio' }, { key: 'execution_mode', label: 'Mode' }, { key: 'gross_return', label: 'Gross Return', format: value => this.formatPercent(value) }, { key: 'net_return', label: 'Net Return', format: value => this.formatPercent(value) }, { key: 'sharpe', label: 'Sharpe', format: value => this.formatMetric(value) }, { key: 'sortino', label: 'Sortino', format: value => this.formatMetric(value) }, { key: 'max_drawdown_pct', label: 'Max DD', format: value => this.formatPercent(value) }, { key: 'volatility', label: 'Volatility', format: value => this.formatPercent(value) }, { key: 'turnover', label: 'Turnover', format: value => this.formatMetric(value) }, { key: 'fees', label: 'Fees', format: value => this.formatMetric(value) }, { key: 'slippage', label: 'Slippage', format: value => this.formatMetric(value) }, { key: 'funding', label: 'Funding', format: value => this.formatMetric(value) }, { key: 'trade_count', label: 'Trades', format: value => this.formatMetric(value, { digits: 0 }) }, { key: 'win_rate', label: 'Win rate', format: value => this.formatPercent(value) }, { key: 'profit_factor', label: 'Profit factor', format: value => this.formatMetric(value) }, { key: 'average_win', label: 'Average win', format: value => this.formatMetric(value) }, { key: 'average_loss', label: 'Average loss', format: value => this.formatMetric(value) }, { key: 'exposure', label: 'Exposure', format: value => this.formatPercent(value) }, { key: 'time_in_market', label: 'Time in market', format: value => this.formatPercent(value) }] },
    alphaColumns () { return [{ key: 'timestamp', label: 'Time', format: value => this.formatTime(value) }, { key: 'alpha_name', label: 'Alpha' }, { key: 'raw_prediction', label: 'Raw', format: value => this.formatMetric(value) }, { key: 'normalized_prediction', label: 'Normalized', format: value => this.formatMetric(value) }, { key: 'availability', label: 'Available', format: value => value === true ? 'YES' : value === false ? 'NO' : 'Unavailable' }, { key: 'observed_at', label: 'Observed at', format: value => this.formatTime(value) }, { key: 'available_at', label: 'Available at', format: value => this.formatTime(value) }, { key: 'meta_input', label: 'Meta input', format: value => value === true ? 'YES' : value === false ? 'NO' : 'Unavailable' }] },
    metaColumns () { return [{ key: 'timestamp', label: 'Time', format: value => this.formatTime(value) }, { key: 'meta_type', label: 'Type' }, { key: 'meta_output', label: 'Output', format: value => this.formatMetric(value) }, { key: 'input_alpha_set', label: 'Inputs', format: value => Array.isArray(value) ? value.join(', ') : 'Unavailable' }] },
    riskColumns () { return [{ key: 'timestamp', label: 'Time', format: value => this.formatTime(value) }, { key: 'regime', label: 'Regime' }, { key: 'meta_raw_signal', label: 'Meta signal', format: value => this.formatMetric(value) }, { key: 'pre_risk_target', label: 'Pre-risk target', format: value => this.formatMetric(value) }, { key: 'volatility_scaling', label: 'Vol scaling', format: value => value === true ? 'Applied' : value === false ? 'No' : 'Unavailable' }, { key: 'regime_scaling', label: 'Regime scaling', format: value => value === true ? 'Applied' : value === false ? 'No' : 'Unavailable' }, { key: 'drawdown_scaling', label: 'DD scaling', format: value => value === true ? 'Applied' : value === false ? 'No' : 'Unavailable' }, { key: 'confidence_scaling', label: 'Confidence scaling', format: value => value === true ? 'Applied' : value === false ? 'No' : 'Unavailable' }, { key: 'combined_scale', label: 'Combined scale', format: value => this.formatMetric(value) }, { key: 'regime_scale', label: 'Regime scale', format: value => this.formatMetric(value) }, { key: 'confidence_scale', label: 'Confidence scale', format: value => this.formatMetric(value) }, { key: 'drawdown_scale', label: 'Drawdown scale', format: value => this.formatMetric(value) }, { key: 'loss_limit_scale', label: 'Loss-limit scale', format: value => this.formatMetric(value) }, { key: 'constraint_reason', label: 'Constraint reason', format: value => value || 'None observed' }, { key: 'decision_status', label: 'Decision status' }, { key: 'post_risk_target', label: 'TargetPosition', format: value => this.formatMetric(value) }] },
    executionColumns () { return [{ key: 'event_id', label: 'Event' }, { key: 'decision_at', label: 'Decision at', format: value => this.formatTime(value) }, { key: 'intent_created', label: 'Order intent', format: value => value ? 'CREATED' : 'NOT_CREATED' }, { key: 'intent_at', label: 'Intent at', format: value => this.formatTime(value) }, { key: 'fill_occurred', label: 'Fill', format: value => value ? 'FILLED' : 'NOT_OCCURRED' }, { key: 'fill_at', label: 'Fill at', format: value => this.formatTime(value) }, { key: 'reference_price', label: 'Reference', format: value => this.formatMetric(value) }, { key: 'fill_price', label: 'Fill', format: value => value === null || value === undefined ? 'Not applicable' : this.formatMetric(value) }, { key: 'slippage_bps', label: 'Slippage bps', format: value => this.formatMetric(value) }, { key: 'requested_quantity', label: 'Requested', format: value => this.formatMetric(value) }, { key: 'filled_quantity', label: 'Filled', format: value => this.formatMetric(value) }, { key: 'fill_type', label: 'Fill type', format: value => value || 'Not applicable' }] },
    decisionColumns () { return [{ key: 'timestamp', label: 'Event time', format: value => this.formatTime(value) }, { key: 'decision_id', label: 'Decision ID' }, { key: 'provenance', label: 'Portfolio', format: value => value && value.portfolio_id ? value.portfolio_id : 'Unavailable' }, { key: 'target_position', label: 'TargetPosition', format: value => this.formatMetric(value) }, { key: 'position', label: 'Actual position', format: value => this.formatMetric(value) }, { key: 'disposition', label: 'Status' }, { key: 'actions', label: '' }] },
    regimeColumns () { return [{ key: 'regime', label: 'Regime' }, { key: 'event_count', label: 'Events' }, { key: 'mean_return', label: 'Mean return', format: value => this.formatPercent(value) }, { key: 'hit_rate', label: 'Hit rate', format: value => this.formatPercent(value) }, { key: 'coverage', label: 'Coverage' }, { key: 'sample_warning', label: 'Sample', format: value => value ? 'LOW SAMPLE' : 'OK' }] },
    alphaRegimeColumns () { return [{ key: 'alpha', label: 'Alpha' }, { key: 'regime', label: 'Regime' }, { key: 'mean_return', label: 'Mean return', format: value => this.formatPercent(value) }, { key: 'hit_rate', label: 'Hit rate', format: value => this.formatPercent(value) }, { key: 'sharpe', label: 'Sharpe', format: value => this.formatMetric(value) }, { key: 'coverage', label: 'Coverage' }, { key: 'sample_warning', label: 'Sample', format: value => value ? 'LOW SAMPLE' : 'OK' }] },
    shadowColumns () { return [{ key: 'portfolio_id', label: 'Portfolio' }, { key: 'execution_mode', label: 'Mode' }, { key: 'net_pnl', label: 'Net PnL', format: value => this.formatMetric(value) }, { key: 'net_return', label: 'Return', format: value => this.formatPercent(value) }, { key: 'max_drawdown', label: 'Drawdown', format: value => this.formatMetric(value) }, { key: 'turnover', label: 'Turnover', format: value => this.formatMetric(value) }, { key: 'fees', label: 'Fees', format: value => this.formatMetric(value) }, { key: 'slippage', label: 'Slippage', format: value => this.formatMetric(value) }, { key: 'funding', label: 'Funding', format: value => this.formatMetric(value) }, { key: 'exposure', label: 'Exposure', format: value => this.formatPercent(value) }] },
    comparisonColumns () { return [{ key: 'execution_mode', label: 'Mode' }, { key: 'available', label: 'Available', format: value => value ? 'YES' : 'NO' }, { key: 'net_return', label: 'Net Return', format: value => this.formatPercent(value) }, { key: 'sharpe', label: 'Sharpe', format: value => this.formatMetric(value) }, { key: 'sortino', label: 'Sortino', format: value => this.formatMetric(value) }, { key: 'max_drawdown', label: 'Max DD', format: value => this.formatMetric(value) }, { key: 'trade_count', label: 'Trades', format: value => this.formatMetric(value, { digits: 0 }) }] },
    comparisonTableRows () { return this.comparisonRows.map(row => { const item = row.performance && row.performance.items && row.performance.items[0] ? row.performance.items[0] : {}; return { execution_mode: row.execution_mode, available: row.available, net_return: item.net_return, sharpe: item.sharpe, sortino: item.sortino, max_drawdown: item.max_drawdown_pct, trade_count: item.trade_count } }) },
    assumptionRows () { const values = this.comparison.assumption_parity || {}; return Object.keys(values).map(key => ({ label: key.replace(/_/g, ' '), value: values[key] })) },
    researchColumns () { return [{ key: 'experiment_id', label: 'Experiment' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'target', label: 'Target' }, { key: 'expected_regime', label: 'Expected regime' }, { key: 'oof_status', label: 'OOF' }, { key: 'robustness_status', label: 'Robustness' }, { key: 'promotion_status', label: 'Promotion' }, { key: 'researchOnly', label: 'Candidate', format: value => value === true ? 'RESEARCH_ONLY' : 'Unavailable' }, { key: 'paperEligible', label: 'Soak eligibility', format: value => value === false ? 'NOT_CURRENT_SOAK' : value === true ? 'ELIGIBLE' : 'Unavailable' }, { key: 'liveEligible', label: 'Live eligibility', format: value => value === false ? 'NOT_LIVE_ELIGIBLE' : value === true ? 'ELIGIBLE' : 'Unavailable' }, { key: 'failure_reason', label: 'Failure reason' }, { key: 'tested_conditions', label: 'Tested conditions' }] },
    hypothesisColumns () { return [{ key: 'hypothesis_id', label: 'Hypothesis' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'failure_reason', label: 'Failure reason' }, { key: 'tested_conditions', label: 'Tested conditions' }] },
    coverageNames () { return ['price', 'funding', 'open_interest'] },
    soakGateRows () { return gateRows(this.soak.checker) },
    accountingIntegrity () { return this.soak.accounting || {} },
    soakElapsedDays () { return this.soak && this.soak.checker ? this.soak.checker.duration_days : this.soak.elapsed_days },
    soakProgress () { const required = Number(this.soak.minimum_required_duration_days || 7); const elapsed = Number(this.soakElapsedDays); return required > 0 && Number.isFinite(elapsed) ? Math.min(100, Math.round((elapsed / required) * 100)) : 0 },
    soakCounterCards () { const counts = this.soak.event_counts || {}; const quality = this.soak.freshness || {}; return [{ key: 'received', label: 'Received events', value: this.formatMetric(counts.received, { digits: 0 }) }, { key: 'accepted', label: 'Accepted events', value: this.formatMetric(counts.accepted, { digits: 0 }) }, { key: 'decisions', label: 'Completed decisions', value: this.formatMetric(counts.completed || counts.model_decisions, { digits: 0 }) }, { key: 'duplicates', label: 'Duplicates prevented', value: this.formatMetric(counts.duplicate, { digits: 0 }) }, { key: 'blocked', label: 'Blocked events', value: this.formatMetric(counts.blocked, { digits: 0 }) }, { key: 'missing', label: 'Missing events', value: this.formatMetric(counts.missing || quality.missing_events, { digits: 0 }) }, { key: 'stale', label: 'Stale events', value: this.formatMetric(counts.stale || quality.stale_cycles, { digits: 0 }) }, { key: 'outoforder', label: 'Out-of-order events', value: this.formatMetric(counts.out_of_order || quality.out_of_order_events, { digits: 0 }) }, { key: 'order_intents', label: 'Order intents', value: this.formatMetric(counts.order_intents, { digits: 0 }) }, { key: 'fills', label: 'Fills', value: this.formatMetric(counts.simulated_fills !== undefined ? counts.simulated_fills : this.soak.last_fill, { digits: 0 }) }, { key: 'closed_trades', label: 'Closed trades', value: this.formatMetric(counts.closed_trades, { digits: 0 }) }, { key: 'position', label: 'Current position (normalized fraction)', value: this.formatMetric(this.soak.current_position) }, { key: 'safety', label: 'Safety violations', value: this.safetyViolations }] },
    qualityCards () { return [{ key: 'received', label: 'Received', value: this.formatMetric(this.quality.received_events, { digits: 0 }) }, { key: 'accepted', label: 'Accepted', value: this.formatMetric(this.quality.accepted_events, { digits: 0 }) }, { key: 'missing', label: 'Missing', value: this.formatMetric(this.quality.missing_events, { digits: 0 }) }, { key: 'duplicate', label: 'Duplicate', value: this.formatMetric(this.quality.duplicate_events, { digits: 0 }) }, { key: 'stale', label: 'Stale', value: this.formatMetric(this.quality.stale_cycles, { digits: 0 }) }, { key: 'outoforder', label: 'Out-of-order', value: this.formatMetric(this.quality.out_of_order_events, { digits: 0 }) }, { key: 'freshness', label: 'Freshness', value: this.quality.freshness_status || 'Unavailable' }] },
    reconciliationLabel () { const value = this.soak.reconciliation && (this.soak.reconciliation.status || this.soak.reconciliation.result); return value || 'Unavailable / Not yet observed' },
    safetyViolations () { const value = this.soak.safety_violations || (this.soak.checker && this.soak.checker.safety_violations); return value === null || value === undefined ? 'Unavailable / Not yet observed' : this.formatMetric(value, { digits: 0 }) }
  },
  watch: {
    activeTab (value) { this.updateQuery({ tab: value }); this.loadData({ silent: true }) }
  },
  mounted () {
    this.restoreQuery()
    this.loadData()
    this.refreshTimer = setInterval(() => this.loadData({ silent: true }), 60000)
  },
  beforeDestroy () { if (this.refreshTimer) clearInterval(this.refreshTimer) },
  methods: {
    requestParams () {
      const params = { execution_mode: this.filters.execution_mode }
      if (this.filters.range && !['full', 'custom', 'since-soak-start'].includes(this.filters.range)) params.range = this.filters.range
      if (this.filters.range === 'since-soak-start' && this.soak.formal_soak_started_at) params.start = this.soak.formal_soak_started_at
      if (this.filters.range === 'custom') {
        if (this.filters.start) params.start = this.filters.start
        if (this.filters.end) params.end = this.filters.end
      }
      const filterKeys = ['portfolio', 'strategy', 'alpha', 'experiment', 'regime', 'instrument', 'timeframe']
      filterKeys.forEach(key => { if (this.filters[key]) params[key] = this.filters[key] })
      if (this.filters.meta_version) params.meta_version = this.filters.meta_version
      if (this.filters.risk_version) params.risk_version = this.filters.risk_version
      return params
    },
    async loadData ({ silent = false } = {}) {
      if (!silent) this.loading = true
      this.apiErrors = []
      const params = this.requestParams()
      const loaders = {
        portfolioPayload: () => getObservabilityPortfolios({ execution_mode: this.filters.execution_mode }),
        performance: () => getObservabilityPerformance(params),
        decisions: () => getObservabilityDecisions(params),
        alpha: () => getObservabilityAlpha(params),
        meta: () => getObservabilityMeta(params),
        risk: () => getObservabilityRisk(params),
        execution: () => getObservabilityExecution(params),
        costs: () => getObservabilityCosts(params),
        comparison: () => getObservabilityComparison(params),
        regimes: () => getObservabilityRegimes(params),
        alphaRegime: () => getObservabilityAlphaRegime(params),
        shadow: () => getObservabilityShadow(params),
        soak: () => getObservabilitySoak(params),
        quality: () => getObservabilityDataQuality(params),
        research: () => getObservabilityResearch(params)
      }
      const activeLoaders = { overview: ['performance', 'decisions'], performance: ['performance', 'costs', 'comparison'], signals: ['alpha', 'meta', 'risk'], execution: ['execution', 'decisions'], regime: ['regimes', 'alphaRegime'], shadow: ['shadow'], comparison: ['performance', 'costs', 'comparison'], research: ['research'], soak: ['soak', 'quality'], quality: ['quality'] }
      const keys = Array.from(new Set(['portfolioPayload', 'soak', 'quality'].concat(activeLoaders[this.activeTab] || [])))
      try {
        const results = await Promise.all(keys.map(async key => {
          try { return [key, unwrapObservabilityResponse(await loaders[key]())] } catch (error) { this.apiErrors.push(key); return [key, null] }
        }))
        results.forEach(([key, value]) => {
          if (value === null || value === undefined) return
          this[key] = value
        })
      } finally {
        if (!silent) this.loading = false
      }
    },
    applyFilters () { this.updateQuery({ mode: this.filters.execution_mode, range: this.filters.range, portfolio: this.filters.portfolio || undefined, experiment: this.filters.experiment || undefined, strategy: this.filters.strategy || undefined, alpha: this.filters.alpha || undefined, meta: this.filters.meta_version || undefined, risk: this.filters.risk_version || undefined, regime: this.filters.regime || undefined, instrument: this.filters.instrument || undefined, timeframe: this.filters.timeframe || undefined, start: this.filters.start || undefined, end: this.filters.end || undefined }); this.loadData() },
    resetFilters () { this.filters = { execution_mode: 'PAPER', range: 'full', portfolio: undefined, experiment: undefined, strategy: undefined, alpha: undefined, meta_version: undefined, risk_version: undefined, regime: undefined, instrument: undefined, timeframe: undefined, start: undefined, end: undefined }; this.advancedFiltersOpen = false; this.applyFilters() },
    restoreQuery () {
      const query = this.$route && this.$route.query ? this.$route.query : {}
      if (this.executionModes.includes(String(query.mode || '').toUpperCase())) this.filters.execution_mode = String(query.mode).toUpperCase()
      if (['full', 'since-soak-start', '24h', '7d', '30d', 'custom'].includes(query.range)) this.filters.range = query.range
      if (query.portfolio) this.filters.portfolio = query.portfolio
      if (query.experiment) this.filters.experiment = query.experiment
      if (query.strategy) this.filters.strategy = query.strategy
      if (query.alpha) this.filters.alpha = query.alpha
      if (query.meta) this.filters.meta_version = query.meta
      if (query.risk) this.filters.risk_version = query.risk
      if (query.regime) this.filters.regime = query.regime
      if (query.instrument) this.filters.instrument = query.instrument
      if (query.timeframe) this.filters.timeframe = query.timeframe
      if (query.start) this.filters.start = query.start
      if (query.end) this.filters.end = query.end
      this.advancedFiltersOpen = ['portfolio', 'experiment', 'strategy', 'alpha', 'meta', 'risk', 'regime', 'instrument', 'timeframe', 'start', 'end'].some(key => Boolean(query[key]))
      if (query.tab) this.activeTab = query.tab
    },
    updateQuery (values) { if (!this.$router || !this.$route) return; this.$router.replace({ query: { ...this.$route.query, ...values } }).catch(() => {}) },
    async openTrace (row) {
      if (!row || !row.event_id) return
      this.traceVisible = true
      this.traceLoading = true
      this.traceError = ''
      this.trace = null
      try { this.trace = unwrapObservabilityResponse(await getObservabilityTrace(row.event_id)) } catch (error) { this.traceError = 'Decision trace API unavailable.' } finally { this.traceLoading = false }
    },
    formatMetric (value, options = {}) { return formatObservabilityValue(value, options) },
    formatPercent (value, options = {}) { return formatObservabilityValue(value, { percent: true, digits: options.digits === undefined ? 2 : options.digits }) },
    formatTime (value) { if (value === null || value === undefined || value === '') return 'Unavailable / Not yet observed'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) },
    shortTime (value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    shortHash (value) { return compactHash(value) },
    duration (value) { return value === null || value === undefined ? 'Unavailable / Not yet observed' : `${this.formatMetric(value, { digits: 1 })} ms` },
    coverageRecord (name) { return (this.quality && this.quality.coverage && this.quality.coverage[name]) || {} },
    coverageLabel (name) { return { price: 'Price coverage', funding: 'Funding coverage', open_interest: 'Open interest coverage' }[name] || name },
    coverageValue (name) { const record = this.coverageRecord(name); return record.count === undefined ? 'Unavailable / Not yet observed' : `${record.count} / ${record.expected}` },
    coveragePct (name) { const record = this.coverageRecord(name); return record.pct === null || record.pct === undefined ? 'percentage unavailable' : this.formatPercent(record.pct) },
    coverageStatus (name) { return this.coverageRecord(name).status || 'UNAVAILABLE' },
    stageStatusColor (status) { return ['AVAILABLE', 'CREATED', 'FILLED', 'OK'].includes(status) ? 'green' : status === 'UNKNOWN' ? 'orange' : 'default' },
    pretty (value) { try { return JSON.stringify(value || {}, null, 2) } catch (error) { return String(value || '') } }
  }
}
</script>

<style scoped>
.observability-page { color: #101828; padding: 6px 4px 38px; }
.observability-header, .context-heading, .soak-header, .filter-bar, .observability-header-actions { align-items: center; display: flex; justify-content: space-between; gap: 16px; }
.observability-header { margin-bottom: 18px; }
.observability-header h1, .context-heading h2, .soak-header h2 { margin: 4px 0; }
.observability-header p, .soak-header p { color: #667085; margin: 0; }
.observability-kicker, .section-kicker { color: #2f80ed; display: block; font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.observability-alert { margin-bottom: 16px; }
.context-banner, .filter-bar { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; margin-bottom: 16px; padding: 16px; }
.context-heading { margin-bottom: 14px; }
.context-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.context-item { background: #f8fafc; border-radius: 8px; display: flex; flex-direction: column; gap: 5px; min-width: 0; padding: 10px 12px; }
.context-item span, .metric-card span, .detail-list span, .assumption-table span { color: #667085; font-size: 12px; }
.context-item strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.filter-bar { flex-wrap: wrap; justify-content: flex-start; }
.filter-title { display: flex; flex-direction: column; margin-right: auto; min-width: 190px; }
.timezone-note { color: #667085; font-size: 11px; margin-left: auto; }
.advanced-toggle { flex: 0 0 auto; }
.advanced-filters { align-items: center; display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 12px; }
.filter-control { min-width: 130px; }
.filter-control-wide { min-width: 190px; }
.observability-tabs ::v-deep .ant-tabs-bar { margin-bottom: 16px; }
.metric-grid { display: grid; gap: 12px; grid-template-columns: repeat(7, minmax(0, 1fr)); margin-bottom: 16px; }
.metric-grid--compact { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.metric-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; display: flex; flex-direction: column; gap: 7px; min-height: 84px; padding: 13px; }
.metric-card strong { font-size: 20px; line-height: 1.2; overflow-wrap: anywhere; }
.metric-card small { color: #98a2b3; }
.metric-card--success { border-color: #abefc6; }
.metric-card--warning { border-color: #fedf89; }
.chart-grid, .two-column-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.chart-grid--wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.chart-grid__full, .section-card { grid-column: 1 / -1; }
.section-card { margin-top: 16px; }
.comparison-grid { display: grid; gap: 10px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.comparison-card { border: 1px solid #e4e7ec; border-radius: 8px; min-height: 106px; padding: 12px; }
.comparison-card--available { border-color: #abefc6; }
.comparison-card__head, .gate-row, .accounting-row, .detail-list > div, .provenance-drawer { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
.comparison-metrics { display: grid; gap: 5px; margin-top: 14px; }
.comparison-metrics span { color: #667085; font-size: 12px; }
.comparison-metrics strong { color: #101828; float: right; }
.muted, .inline-empty { color: #98a2b3; }
.inline-empty { padding: 30px 12px; text-align: center; }
.data-table-wrap { overflow-x: auto; }
.data-table { border-collapse: collapse; min-width: 100%; width: max-content; }
.data-table th, .data-table td { border-bottom: 1px solid #f0f2f5; padding: 10px 12px; text-align: left; white-space: nowrap; }
.data-table th { color: #667085; font-size: 12px; font-weight: 600; }
.data-table td { font-size: 13px; }
.accounting-list { display: grid; gap: 12px; }
.accounting-row { border-bottom: 1px solid #f0f2f5; flex-wrap: wrap; justify-content: flex-start; padding-bottom: 10px; }
.accounting-row > * { margin-right: 8px; }
.accounting-minus { color: #d64545; }.accounting-funding { color: #12b76a; }.accounting-net { color: #101828; }
.detail-list { display: grid; gap: 12px; margin-bottom: 16px; }.detail-list--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.detail-list > div { border-bottom: 1px solid #f0f2f5; padding-bottom: 8px; }
.detail-list strong { overflow-wrap: anywhere; text-align: right; }
.no-fill-callout { background: #eff8ff; border-radius: 8px; color: #175cd3; margin-top: 12px; padding: 11px 13px; }
.research-lifecycle { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }.lifecycle-stage { background: #f2f4f7; border-radius: 999px; color: #475467; font-size: 12px; padding: 7px 11px; }.lifecycle-stage + .lifecycle-stage::before { color: #98a2b3; content: '→'; margin-right: 8px; }
.soak-progress { min-width: 250px; text-align: right; }.soak-progress strong { display: block; font-size: 24px; }.soak-progress span { color: #667085; font-size: 12px; }
.gate-list { display: grid; gap: 10px; }.gate-row { border-bottom: 1px solid #f0f2f5; padding-bottom: 9px; }
.checker-result { align-items: center; border-bottom: 1px solid #f0f2f5; display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; }.checker-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }.reason-chip { background: #fff4e5; border-radius: 999px; color: #b54708; font-size: 11px; padding: 4px 8px; }
.trace-stage { display: flex; gap: 12px; padding: 12px 0; }.trace-stage__rail { align-items: center; display: flex; flex-direction: column; }.trace-stage__rail span { align-items: center; background: #eff8ff; border-radius: 50%; color: #175cd3; display: flex; height: 28px; justify-content: center; width: 28px; }.trace-stage__rail i { background: #d0d5dd; flex: 1; margin-top: 4px; min-height: 28px; width: 1px; }.trace-stage__body { flex: 1; min-width: 0; }.trace-stage__heading { align-items: center; display: flex; gap: 8px; justify-content: space-between; }.trace-stage small { color: #98a2b3; display: block; margin: 3px 0 7px; }.trace-stage pre { background: #f8fafc; border-radius: 6px; max-width: 620px; overflow: auto; padding: 10px; white-space: pre-wrap; }
.theme-dark { color: #f2f4f7; }.theme-dark .context-banner, .theme-dark .filter-bar, .theme-dark .metric-card { background: #1c1c1c; border-color: #2a2a2a; }.theme-dark .context-item { background: #141414; }.theme-dark .data-table th, .theme-dark .data-table td, .theme-dark .detail-list > div, .theme-dark .gate-row, .theme-dark .accounting-row { border-color: #2a2a2a; }.theme-dark .context-item span, .theme-dark .metric-card span, .theme-dark .detail-list span, .theme-dark .assumption-table span, .theme-dark .data-table th, .theme-dark .timezone-note { color: #b8c0cc; }.theme-dark .muted, .theme-dark .observability-header p, .theme-dark .soak-header p, .theme-dark .soak-progress span { color: #98a2b3; }.theme-dark .data-table td, .theme-dark .comparison-metrics strong, .theme-dark .accounting-net { color: #f2f4f7; }.theme-dark .trace-stage pre { background: #141414; }
@media (max-width: 1200px) { .metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }.comparison-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 800px) { .observability-header, .soak-header { align-items: flex-start; flex-direction: column; }.observability-header-actions { flex-wrap: wrap; }.context-grid, .chart-grid, .two-column-grid { grid-template-columns: 1fr; }.metric-grid, .metric-grid--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }.comparison-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.filter-title { flex-basis: 100%; }.timezone-note { margin-left: 0; }.filter-control, .filter-control-wide { flex: 1 1 140px; min-width: 0; }.advanced-filters { flex-basis: 100%; }.soak-progress { min-width: 0; text-align: left; width: 100%; }.observability-tabs { max-width: 100%; overflow: hidden; }.observability-tabs ::v-deep .ant-tabs-nav-wrap { overflow-x: auto; }.observability-tabs ::v-deep .ant-tabs-nav-scroll { overflow: visible; }.observability-page { max-width: 100%; overflow-x: hidden; } }
@media (max-width: 480px) { .metric-grid, .comparison-grid { grid-template-columns: 1fr; }.detail-list--grid { grid-template-columns: 1fr; }.observability-page { padding-left: 0; padding-right: 0; } }
</style>
