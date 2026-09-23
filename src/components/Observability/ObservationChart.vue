<template>
  <div class="observation-chart" :style="{ height: `${height}px` }">
    <div v-if="!hasData" class="observation-chart__empty">{{ emptyText }}</div>
    <div v-else ref="canvas" class="observation-chart__canvas"></div>
  </div>
</template>

<script>
import * as echarts from 'echarts'

export default {
  name: 'ObservationChart',
  props: {
    categories: { type: Array, default: () => [] },
    series: { type: Array, default: () => [] },
    height: { type: Number, default: 280 },
    emptyText: { type: String, default: 'No data yet' },
    yAxisName: { type: String, default: '' },
    area: { type: Boolean, default: false }
  },
  data () { return { chart: null, resizeObserver: null } },
  computed: { hasData () { return this.categories.length > 0 && this.series.some(item => (item.data || []).some(value => value !== null && value !== undefined)) } },
  watch: {
    categories: { deep: true, handler () { this.$nextTick(this.render) } },
    series: { deep: true, handler () { this.$nextTick(this.render) } },
    height () { this.$nextTick(this.render) }
  },
  mounted () {
    this.$nextTick(() => {
      this.render()
      if (typeof ResizeObserver !== 'undefined' && this.$refs.canvas) {
        this.resizeObserver = new ResizeObserver(() => this.resize())
        this.resizeObserver.observe(this.$refs.canvas)
      }
    })
  },
  beforeDestroy () {
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.chart) this.chart.dispose()
  },
  methods: {
    render () {
      if (!this.hasData || !this.$refs.canvas) {
        if (this.chart) this.chart.clear()
        return
      }
      if (!this.chart) this.chart = echarts.init(this.$refs.canvas, null, { renderer: 'canvas' })
      const dark = document.body.classList.contains('dark') || document.body.classList.contains('realdark')
      const textColor = dark ? '#98a2b3' : '#667085'
      const gridColor = dark ? '#2b3340' : '#edf0f4'
      this.chart.setOption({
        animation: false,
        grid: { left: 56, right: 18, top: 18, bottom: 36 },
        tooltip: { trigger: 'axis', backgroundColor: dark ? '#171a1f' : '#fff', borderColor: dark ? '#343942' : '#e4e8ef', textStyle: { color: dark ? '#f2f4f7' : '#101828' } },
        legend: { show: this.series.length > 1, top: 0, textStyle: { color: textColor } },
        xAxis: { type: 'category', boundaryGap: false, data: this.categories, axisLabel: { color: textColor, hideOverlap: true }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: this.yAxisName, scale: true, splitNumber: 4, nameTextStyle: { color: textColor }, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor } } },
        series: this.series.map(item => ({ type: item.type || 'line', name: item.name, data: item.data, symbol: 'none', smooth: 0.18, connectNulls: false, lineStyle: { width: 2, color: item.color }, itemStyle: { color: item.color }, areaStyle: this.area ? { opacity: 0.1, color: item.color } : undefined }))
      }, true)
      this.resize()
    },
    resize () { if (this.chart) this.chart.resize() }
  }
}
</script>

<style scoped>
.observation-chart { min-height: 160px; position: relative; width: 100%; }
.observation-chart__canvas { height: 100%; width: 100%; }
.observation-chart__empty { align-items: center; color: #98a2b3; display: flex; height: 100%; justify-content: center; min-height: 160px; padding: 24px; text-align: center; }
</style>
