/** Small form controls. Every one is a real <select>/<button> so keyboard and screen
 *  readers work without extra wiring, and every one is controlled by the URL. */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function ControlRow({ children }: { children: ReactNode }) {
  return <div className="control-row">{children}</div>
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  hint?: string
}) {
  return (
    <label className="control">
      <span className="control-label">
        {label}
        {hint ? <span className="control-hint">{hint}</span> : null}
      </span>
      <select
        value={String(value)}
        onChange={(event) => {
          const raw = event.target.value
          const match = options.find((option) => String(option.value) === raw)
          if (match) onChange(match.value)
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string; title?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="control">
      {label ? <span className="control-label">{label}</span> : null}
      <div className="toggle-group" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            className={`toggle${option.value === value ? ' is-on' : ''}`}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Multi-select chips, used wherever the reader picks several economies to compare. */
export function Chips({
  label,
  values,
  selected,
  onToggle,
  max,
  min = 0,
  hint,
}: {
  label: string
  values: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  max?: number
  min?: number
  hint?: string
}) {
  return (
    <div className="control chips-control">
      <span className="control-label">
        {label}
        {hint ? <span className="control-hint">{hint}</span> : null}
      </span>
      <div className="chips">
        {values.map((entry) => {
          const isOn = selected.includes(entry.value)
          const blocked = (!isOn && max !== undefined && selected.length >= max) || (isOn && selected.length <= min)
          return (
            <button
              key={entry.value}
              type="button"
              className={`chip${isOn ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}`}
              aria-pressed={isOn}
              aria-disabled={blocked || undefined}
              title={blocked ? `At most ${max} at a time` : entry.label}
              onClick={() => {
                if (blocked) return
                onToggle(entry.value)
              }}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Searchable multi-select for bounded economy comparisons. */
const ECONOMY_RESULT_LIMIT = 10

export function EconomyPicker({
  label,
  values,
  selected,
  resetValues,
  onChange,
  max = 8,
  hint,
}: {
  label: string
  values: { value: string; label: string }[]
  selected: string[]
  resetValues: string[]
  onChange: (values: string[]) => void
  max?: number
  hint?: string
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pickerId = useId().replace(/:/g, '')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matchingValues = useMemo(
    () =>
      values
        .filter(
          (entry) =>
            !normalizedQuery ||
            entry.value.toLocaleLowerCase().includes(normalizedQuery) ||
            entry.label.toLocaleLowerCase().includes(normalizedQuery),
        )
        .sort((a, b) => {
          const aLabel = a.label.toLocaleLowerCase()
          const bLabel = b.label.toLocaleLowerCase()
          if (!normalizedQuery) return aLabel.localeCompare(bLabel)
          const aExact = a.value.toLocaleLowerCase() === normalizedQuery || aLabel === normalizedQuery
          const bExact = b.value.toLocaleLowerCase() === normalizedQuery || bLabel === normalizedQuery
          if (aExact !== bExact) return aExact ? -1 : 1
          const aStarts = a.value.toLocaleLowerCase().startsWith(normalizedQuery) || aLabel.startsWith(normalizedQuery)
          const bStarts = b.value.toLocaleLowerCase().startsWith(normalizedQuery) || bLabel.startsWith(normalizedQuery)
          if (aStarts !== bStarts) return aStarts ? -1 : 1
          return aLabel.localeCompare(bLabel)
        }),
    [normalizedQuery, values],
  )
  const results = matchingValues.slice(0, ECONOMY_RESULT_LIMIT)
  const selectedLabel = new Map(values.map((entry) => [entry.value, entry.label]))
  const popoverId = `economy-picker-${pickerId}`
  const resultsId = `${popoverId}-results`
  const optionId = (value: string) => `${resultsId}-${value.toLocaleLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
  const isDisabled = (entry: { value: string }) =>
    selected.includes(entry.value) || selected.length >= max
  const firstEnabledIndex = results.findIndex((entry) => !isDisabled(entry))
  const activeResult = results[activeIndex] && !isDisabled(results[activeIndex]!)
    ? results[activeIndex]
    : firstEnabledIndex >= 0
      ? results[firstEnabledIndex]
      : undefined

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setQuery('')
        setActiveIndex(0)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  const addEconomy = (entry: { value: string; label: string }) => {
    if (isDisabled(entry)) return
    onChange([...selected, entry.value])
    setQuery('')
    setActiveIndex(0)
    setIsOpen(false)
    setStatusMessage(`${entry.label} added. ${selected.length + 1} selected.`)
    triggerRef.current?.focus()
  }

  const moveActive = (direction: 1 | -1) => {
    if (results.length === 0) return
    const currentIndex = activeResult ? results.findIndex((entry) => entry.value === activeResult.value) : -1
    for (let step = 1; step <= results.length; step += 1) {
      const nextIndex = (currentIndex + direction * step + results.length) % results.length
      if (!isDisabled(results[nextIndex]!)) {
        setActiveIndex(nextIndex)
        return
      }
    }
  }

  const openPicker = () => {
    if (selected.length >= max || values.length === 0) return
    setQuery('')
    setActiveIndex(0)
    setStatusMessage('')
    setIsOpen(true)
  }

  const resetPicker = () => {
    onChange(resetValues.slice(0, max))
    setQuery('')
    setActiveIndex(0)
    setIsOpen(false)
    setStatusMessage('Comparison economies reset.')
  }

  return (
    <div className="control economy-picker" ref={pickerRef}>
      <span className="control-label">
        {label}
        {hint ? <span className="control-hint">{hint}</span> : null}
      </span>

      <button
        ref={triggerRef}
        type="button"
        className="economy-picker-trigger"
        onClick={openPicker}
        disabled={selected.length >= max || values.length === 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={popoverId}
        aria-label={
          values.length === 0
            ? 'Add economy; no economies are available for this year'
            : selected.length >= max
              ? `Add economy; maximum ${max} economies selected`
              : 'Add economy'
        }
        title={
          values.length === 0
            ? 'No economies are available for this year'
            : selected.length >= max
              ? `Maximum ${max} economies selected. Remove one to add another.`
              : undefined
        }
      >
        Add economy
      </button>

      {isOpen ? (
        <div id={popoverId} className="economy-picker-popover">
          <label className="economy-picker-search">
            <span className="sr-only">Search economies by name or code</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
                setStatusMessage('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveActive(event.key === 'ArrowDown' ? 1 : -1)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  if (activeResult) addEconomy(activeResult)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setIsOpen(false)
                  setQuery('')
                  setActiveIndex(0)
                  triggerRef.current?.focus()
                }
              }}
              placeholder="Search name or code"
              aria-label="Search economies by name or code"
              role="combobox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls={resultsId}
              aria-activedescendant={activeResult ? optionId(activeResult.value) : undefined}
            />
          </label>

          <div id={resultsId} className="economy-picker-results" role="listbox" aria-label="Matching economies">
            {results.length > 0 ? (
              results.map((entry) => {
                const isSelected = selected.includes(entry.value)
                const atCapacity = !isSelected && selected.length >= max
                return (
                  <button
                    key={entry.value}
                    type="button"
                    role="option"
                    id={optionId(entry.value)}
                    className={`economy-picker-option${entry.value === activeResult?.value ? ' is-active' : ''}`}
                    aria-selected={isSelected}
                    aria-disabled={isSelected || atCapacity || undefined}
                    disabled={isSelected || atCapacity}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addEconomy(entry)}
                  >
                    <span className="economy-picker-option-label">{entry.label}</span>
                    {isSelected ? (
                      <span className="economy-picker-option-status">Already selected</span>
                    ) : atCapacity ? (
                      <span className="economy-picker-option-status">Maximum reached</span>
                    ) : null}
                  </button>
                )
              })
            ) : (
              <p className="picker-status" role="status">
                {values.length === 0
                  ? 'No economies are available for this year.'
                  : `No economies match “${query.trim()}”.`}
              </p>
            )}
          </div>

          {matchingValues.length > results.length ? (
            <p className="picker-hint">
              Showing {results.length} of {matchingValues.length} matches; type to narrow the list.
            </p>
          ) : !normalizedQuery && results.length > 0 ? (
            <p className="picker-hint">Showing {results.length} alphabetical suggestions; type a name or code to narrow.</p>
          ) : null}
        </div>
      ) : null}

      <div className="economy-picker-meta">
        <span>
          {selected.length} selected; maximum {max}.
        </span>
        <button
          type="button"
          className="picker-reset"
          onClick={resetPicker}
        >
          Reset to six comparison economies
        </button>
      </div>

      <div className="selected-economies" role="list" aria-label="Selected economies">
        {selected.map((code) => (
          <div className="selected-economy" role="listitem" key={code}>
            <span>{selectedLabel.get(code) ?? code}</span>
            <button
              type="button"
              className="selected-economy-remove"
              onClick={() => onChange(selected.filter((entry) => entry !== code))}
              disabled={selected.length <= 1}
              aria-label={`Remove ${selectedLabel.get(code) ?? code}`}
              title={selected.length <= 1 ? 'Keep at least one economy selected' : undefined}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {selected.length >= max ? (
        <p className="picker-status" role="status">
          Maximum {max} economies selected. Remove one to add another.
        </p>
      ) : null}
      {statusMessage ? (
        <p className="picker-status picker-announcement" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}

/** Checkbox list used for the 80-economy source-service breakdown. */
export function CheckboxList({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string
  values: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <fieldset className="control checkbox-control">
      <legend className="control-label">{label}</legend>
      <div className="checkbox-grid">
        {values.map((entry) => (
          <label key={entry.value} className="checkbox-item">
            <input
              type="checkbox"
              checked={selected.includes(entry.value)}
              onChange={() => onToggle(entry.value)}
            />
            {entry.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
