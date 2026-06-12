<template>
  <div class="chart">
    <n-empty v-if="!hasData" description="Немає даних для графіка" size="small" style="padding: 24px 0;" />
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="chart-svg" preserveAspectRatio="none">
      <!-- базова лінія -->
      <line :x1="padL" :y1="baseY" :x2="W - padR" :y2="baseY" class="axis" />

      <g v-for="(bar, i) in bars" :key="i">
        <rect
          v-if="bar.h >= 1"
          :x="bar.x" :y="bar.y" :width="barW" :height="bar.h"
          rx="3" class="bar"
        >
          <title>{{ bar.label }}: {{ formatPrice(bar.total) }}</title>
        </rect>
        <text :x="bar.cx" :y="H - 4" text-anchor="middle" class="x-label">{{ bar.label }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NEmpty } from 'naive-ui'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ label, total }]
})

const W = 600
const H = 200
const padL = 8
const padR = 8
const padT = 12
const baseY = H - 22 // місце для підписів місяців

const hasData = computed(() => props.series.some(s => s.total > 0))

const maxTotal = computed(() => Math.max(...props.series.map(s => s.total), 1))

const slot = computed(() => (W - padL - padR) / Math.max(props.series.length, 1))
const barW = computed(() => slot.value * 0.6)

const bars = computed(() =>
  props.series.map((s, i) => {
    const h = (s.total / maxTotal.value) * (baseY - padT)
    const x = padL + i * slot.value + (slot.value - barW.value) / 2
    return {
      x,
      cx: x + barW.value / 2,
      y: baseY - h,
      h,
      label: s.label,
      total: s.total,
    }
  })
)

function formatPrice(v) {
  return `${Number(v).toFixed(2)} грн`
}
</script>

<style scoped>
.chart {
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: 200px;
  display: block;
}

.bar {
  fill: var(--brand-color, #18a058);
  transition: opacity 0.15s;
}

.bar:hover {
  opacity: 0.75;
}

.axis {
  stroke: rgba(128, 128, 128, 0.3);
  stroke-width: 1;
}

.x-label {
  font-size: 9px;
  fill: rgba(128, 128, 128, 0.85);
}
</style>
