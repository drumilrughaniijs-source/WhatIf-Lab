const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const moneyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const fmt = {
  compact: (n: number) => compact.format(n),
  money: (n: number) => money.format(n),
  moneyCompact: (n: number) => moneyCompact.format(n),
  num: (n: number, digits = 2) =>
    n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }),
  fixed: (n: number, digits = 2) => n.toFixed(digits),
  pct: (n: number, digits = 1) => `${n.toFixed(digits)}%`,
}
