import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, OctagonAlert, X } from 'lucide-react'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ Panel */

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('rounded-xl border border-white/[0.07] bg-ink-900', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-fg">
            {icon}
            {title}
          </h3>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ---------------------------------------------------------------- Tooltip */

/** Info icon with a tooltip that opens on hover, keyboard focus or tap. */
export function Tip({ text, label = 'More information' }: { text: ReactNode; label?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const show = () => {
    // Open towards whichever side has room, so the tooltip never leaves the viewport.
    const r = anchor.current?.getBoundingClientRect()
    if (r) setAlignRight(r.left + 248 > window.innerWidth - 8)
    setOpen(true)
  }
  return (
    <span ref={anchor} className="relative inline-flex normal-case" onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="grid h-5 w-5 place-items-center rounded text-fg-subtle transition-colors hover:text-fg"
      >
        <Info size={13} aria-hidden />
      </button>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'absolute bottom-full z-40 mb-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs leading-relaxed font-normal tracking-normal text-fg-muted shadow-xl shadow-black/40',
          alignRight ? 'right-[-8px]' : 'left-[-8px]',
          open ? 'block' : 'hidden',
        )}
      >
        {text}
      </span>
    </span>
  )
}

/* ----------------------------------------------------------------- Slider */

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  accent = '#22d3ee',
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  accent?: string
  hint?: ReactNode
}) {
  const id = useId()
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-[13px] text-fg-muted">
          <label htmlFor={id}>{label}</label>
          {hint && <Tip text={hint} label={`About ${label}`} />}
        </span>
        <output htmlFor={id} className="font-mono text-[13px] font-medium text-fg tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="lab-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--accent': accent, '--fill': `${fill}%` } as CSSProperties}
      />
    </div>
  )
}

/* -------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accent = '#22d3ee',
  label,
  hint,
}: {
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  accent?: string
  label?: string
  hint?: ReactNode
}) {
  const layoutId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex((o) => o.value === value)
  const move = (d: number) => {
    const next = (idx + d + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center gap-1 text-[13px] text-fg-muted">
          {label}
          {hint && <Tip text={hint} label={`About ${label}`} />}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-ink-950/60 p-1"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), move(1))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), move(-1))
        }}
      >
        {options.map((o, i) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (idx === -1 && i === 0) ? 0 : -1}
              title={o.title}
              onClick={() => onChange(o.value)}
              className={cn(
                'relative flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                active ? 'text-ink-950' : 'text-fg-muted hover:text-fg',
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-md"
                  style={{ background: accent }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Toggle */

export function Toggle({
  label,
  checked,
  onChange,
  accent = '#22d3ee',
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  accent?: string
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-fg-muted">
      <span className="flex items-center gap-1">
        <label htmlFor={id} className="cursor-pointer">
          {label}
        </label>
        {hint && <Tip text={hint} label={`About ${label}`} />}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? accent : 'var(--color-ink-700)' }}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        />
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- Button */

export function Button({
  children,
  onClick,
  variant = 'secondary',
  accent = '#22d3ee',
  disabled,
  title,
  className,
  type = 'button',
  ...rest
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  accent?: string
  disabled?: boolean
  title?: string
  className?: string
  type?: 'button' | 'submit'
  'aria-label'?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rest['aria-label'] ?? title}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background,border-color,color,filter,transform]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'text-ink-950 hover:brightness-110 active:scale-[0.98]',
        variant === 'secondary' && 'border border-white/10 bg-ink-800 text-fg hover:border-white/20 hover:bg-ink-700',
        variant === 'ghost' && 'text-fg-muted hover:bg-white/5 hover:text-fg',
        variant === 'danger' && 'border border-crit/30 bg-crit/10 text-crit hover:bg-crit/20',
        className,
      )}
      style={variant === 'primary' ? { background: accent } : undefined}
    >
      {children}
    </button>
  )
}

/** Anchor styled like a Button. */
export function LinkButton({
  href,
  children,
  variant = 'secondary',
  accent = '#22d3ee',
  className,
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  accent?: string
  className?: string
}) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background,border-color,color,filter]',
        variant === 'primary' && 'text-ink-950 hover:brightness-110',
        variant === 'secondary' && 'border border-white/10 bg-ink-800 text-fg hover:border-white/20 hover:bg-ink-700',
        variant === 'ghost' && 'text-fg-muted hover:bg-white/5 hover:text-fg',
        className,
      )}
      style={variant === 'primary' ? { background: accent } : undefined}
    >
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  sub,
  accent,
  hint,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: string
  hint?: ReactNode
}) {
  return (
    <div className="relative min-w-0 rounded-xl border border-white/[0.07] bg-ink-900 px-4 py-3">
      {accent && <span className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full" style={{ background: accent }} />}
      <div className="flex items-center gap-1 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
        <span className="truncate">{label}</span>
        {hint && <Tip text={hint} label={`About ${label}`} />}
      </div>
      <div className="mt-1 truncate font-mono text-lg font-semibold text-fg tabular-nums sm:text-xl">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-fg-muted">{sub}</div>}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>
}

/* ---------------------------------------------------------- Chart helpers */

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown }

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormat = (l) => String(l),
  valueFormat = (v) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 3 }) : String(v)),
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: string | number
  labelFormat?: (l: string | number) => string
  valueFormat?: (v: number | string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && <div className="mb-1 font-medium text-fg">{labelFormat(label)}</div>}
      <div className="space-y-0.5">
        {payload
          .filter((p) => p.value !== undefined && p.value !== null && !Array.isArray(p.value))
          .map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-fg-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span>{p.name}</span>
              <span className="ml-auto pl-3 font-mono text-fg tabular-nums">{valueFormat(p.value as number | string)}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; swatch?: 'line' | 'box' }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.swatch === 'box' ? (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          ) : (
            <span
              className="h-0.5 w-4 rounded"
              style={{
                background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color,
              }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- Callouts */

export function Insight({ children, accent = '#22d3ee' }: { children: ReactNode; accent?: string }) {
  return (
    <div
      className="flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed text-fg-muted"
      style={{ borderColor: `${accent}30`, background: `${accent}0a` }}
      aria-live="polite"
    >
      <Lightbulb size={16} className="mt-0.5 shrink-0" style={{ color: accent }} aria-hidden />
      <div>{children}</div>
    </div>
  )
}

const CALLOUT = {
  info: { icon: Info, color: '#60a5fa', label: 'Note' },
  ok: { icon: CheckCircle2, color: '#34d399', label: 'OK' },
  warn: { icon: AlertTriangle, color: '#fbbf24', label: 'Warning' },
  crit: { icon: OctagonAlert, color: '#f87171', label: 'Critical' },
} as const

export function Callout({
  kind = 'info',
  title,
  children,
  className,
}: {
  kind?: keyof typeof CALLOUT
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const c = CALLOUT[kind]
  const Icon = c.icon
  return (
    <div
      role={kind === 'crit' || kind === 'warn' ? 'alert' : 'note'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed', className)}
      style={{ borderColor: `${c.color}40`, background: `${c.color}0d` }}
    >
      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: c.color }} aria-label={c.label} />
      <div className="min-w-0 text-fg-muted">
        {title && <div className="font-medium text-fg">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-ink-850 text-fg-subtle">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Controls({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  initialFocus,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  initialFocus?: RefObject<HTMLElement | null>
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Keep the latest callbacks in refs so the focus effect runs only when `open` changes.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const initialFocusRef = useRef(initialFocus)
  initialFocusRef.current = initialFocus

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const t = setTimeout(() => (initialFocusRef.current?.current ?? panel.current)?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, input, a[href], select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="relative w-full max-w-md rounded-xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/50 outline-none"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
              <h2 id={titleId} className="text-sm font-semibold">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="rounded p-1 text-fg-subtle hover:bg-white/5 hover:text-fg" aria-label="Close dialog">
                <X size={16} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ Toast */

type ToastKind = 'ok' | 'crit' | 'info'
interface ToastMsg {
  id: number
  kind: ToastKind
  text: ReactNode
}
const TOAST_EVENT = 'whatiflab:toast'
let toastId = 0

export function toast(text: ReactNode, kind: ToastKind = 'ok') {
  window.dispatchEvent(new CustomEvent<ToastMsg>(TOAST_EVENT, { detail: { id: ++toastId, kind, text } }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const msg = (e as CustomEvent<ToastMsg>).detail
      setItems((xs) => [...xs, msg])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== msg.id)), 4200)
    }
    window.addEventListener(TOAST_EVENT, on)
    return () => window.removeEventListener(TOAST_EVENT, on)
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite" role="status">
      <AnimatePresence>
        {items.map((t) => {
          const c = CALLOUT[t.kind]
          const Icon = c.icon
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-[13px] text-fg shadow-xl shadow-black/40"
            >
              <Icon size={16} className="mt-0.5 shrink-0" style={{ color: c.color }} aria-hidden />
              <div className="min-w-0 flex-1">{t.text}</div>
              <button
                type="button"
                className="text-fg-subtle hover:text-fg"
                aria-label="Dismiss notification"
                onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
