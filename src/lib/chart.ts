/** Chart tokens — validated dark-surface categorical slots, recessive axes. */
export const SERIES = ['#3987e5', '#d95926', '#199e70'] as const

export const axisProps = {
  stroke: 'rgba(148,163,184,0.25)',
  tickLine: false,
  tick: { fill: '#737d99', fontSize: 11 },
} as const

export const gridProps = {
  strokeDasharray: '0',
  vertical: false,
} as const
