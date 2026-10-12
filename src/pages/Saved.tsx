import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { CategoryBadge } from '../components/SimCard'
import { Button, Callout, EmptyState, LinkButton, toast } from '../components/ui'
import { href } from '../lib/router'
import { clearSaved, deleteExperiment, renameExperiment, repairSaved, useSaved, type SavedExperiment } from '../lib/storage'
import { simById } from '../sims/registry'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function SavedRow({ exp }: { exp: SavedExperiment }) {
  const sim = simById(exp.simId)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(exp.name)

  const commitRename = () => {
    if (name.trim() && name.trim() !== exp.name) {
      if (!renameExperiment(exp.id, name)) toast('Could not rename: browser storage is unavailable.', 'crit')
    } else setName(exp.name)
    setEditing(false)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="rounded-xl border border-white/[0.07] bg-ink-900 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {sim ? <CategoryBadge id={sim.category} size="xs" /> : <span className="text-[11px] text-warn">Unknown simulation</span>}
            <span className="text-[11px] text-fg-subtle">{dateFmt.format(exp.createdAt)}</span>
          </div>
          {editing ? (
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                commitRename()
              }}
            >
              <label className="sr-only" htmlFor={`rename-${exp.id}`}>
                Experiment name
              </label>
              <input
                id={`rename-${exp.id}`}
                autoFocus
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setName(exp.name), setEditing(false))}
                className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-ink-950 px-2.5 text-sm focus:border-brand/50 focus:outline-none"
              />
              <button type="submit" className="rounded-md p-1.5 text-ok hover:bg-white/5" aria-label="Save name">
                <Check size={16} />
              </button>
              <button type="button" onClick={() => (setName(exp.name), setEditing(false))} className="rounded-md p-1.5 text-fg-muted hover:bg-white/5" aria-label="Cancel rename">
                <X size={16} />
              </button>
            </form>
          ) : (
            <h2 className="mt-2 flex items-center gap-2 font-semibold">
              <span className="truncate">{exp.name}</span>
              <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-fg-subtle hover:text-fg" aria-label={`Rename ${exp.name}`}>
                <Pencil size={13} />
              </button>
            </h2>
          )}
          <p className="mt-0.5 text-[13px] text-fg-muted">{sim?.title ?? `“${exp.simId}” is no longer available`}</p>
          {exp.summary.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-1.5">
              {exp.summary.slice(0, 8).map((s) => (
                <div key={s.label} className="flex gap-1.5 rounded-md border border-white/[0.06] bg-ink-950/60 px-2 py-1 text-[11px]">
                  <dt className="text-fg-subtle">{s.label}</dt>
                  <dd className="font-mono text-fg">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-fg-muted">Delete?</span>
              <Button
                variant="danger"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  if (deleteExperiment(exp.id)) toast(`Deleted “${exp.name}”.`, 'info')
                  else toast('Could not delete: browser storage is unavailable.', 'crit')
                }}
              >
                Delete
              </Button>
              <Button className="px-3 py-1.5 text-xs" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {sim && (
                <LinkButton href={href.sim(sim.id, exp.id)} variant="primary" className="px-3 py-1.5 text-xs">
                  <RotateCcw size={13} /> Restore
                </LinkButton>
              )}
              <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setConfirming(true)} aria-label={`Delete ${exp.name}`}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.li>
  )
}

export function Saved() {
  const saved = useSaved()
  const [confirmAll, setConfirmAll] = useState(false)

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">Saved in this browser</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">My Experiments</h1>
        </div>
        {saved.items.length > 0 &&
          (confirmAll ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-muted">Delete all {saved.items.length}?</span>
              <Button
                variant="danger"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  clearSaved()
                  setConfirmAll(false)
                  toast('All saved experiments deleted.', 'info')
                }}
              >
                Delete all
              </Button>
              <Button className="px-3 py-1.5 text-xs" onClick={() => setConfirmAll(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="text-xs" onClick={() => setConfirmAll(true)}>
              <Trash2 size={14} /> Delete all
            </Button>
          ))}
      </header>

      <Callout kind="info" className="mt-6">
        Experiments are stored in this browser’s local storage. They are not uploaded or synchronised across devices, and clearing your browser data will remove them.
      </Callout>

      {saved.unavailable && (
        <Callout kind="warn" className="mt-3" title="Browser storage is unavailable">
          Your browser is blocking local storage (for example in some private-browsing modes), so experiments cannot be saved here.
        </Callout>
      )}
      {saved.corrupted && (
        <Callout kind="warn" className="mt-3" title="Saved data could not be read">
          The stored data is damaged and was ignored.{' '}
          <button type="button" className="text-brand hover:underline" onClick={() => clearSaved()}>
            Reset saved experiments
          </button>
        </Callout>
      )}
      {saved.invalid > 0 && (
        <Callout kind="warn" className="mt-3" title={`${saved.invalid} saved entr${saved.invalid === 1 ? 'y was' : 'ies were'} invalid and skipped`}>
          They may come from an older version or have been edited by hand.{' '}
          <button type="button" className="text-brand hover:underline" onClick={() => repairSaved()}>
            Remove invalid entries
          </button>
        </Callout>
      )}

      <div className="mt-6">
        {saved.items.length ? (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {saved.items.map((e) => (
                <SavedRow key={e.id} exp={e} />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <EmptyState
            icon={<Bookmark size={20} />}
            title="No saved experiments yet"
            action={
              <LinkButton href={href.explore()} variant="primary">
                Explore simulations
              </LinkButton>
            }
          >
            Open any simulation, set it up the way you like, and press “Save experiment”. You can restore it here later.
          </EmptyState>
        )}
      </div>
    </div>
  )
}
