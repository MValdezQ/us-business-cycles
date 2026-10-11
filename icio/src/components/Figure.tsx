import type { ReactNode } from 'react'

interface FigureProps {
  id?: string
  title: string
  lede?: ReactNode
  controls?: ReactNode
  children: ReactNode
  /** One or two sentences telling the reader what to look at, in plain language. */
  note?: ReactNode
  /** Data source line, repeated on every figure so a screenshot is still attributable. */
  source?: boolean
}

/**
 * One consistent frame for every figure: title, controls, the chart, a plain-language note
 * and the source line. Keeping the source attached to the figure (not only in the footer)
 * means a copied screenshot still carries its attribution.
 */
export function Figure({ id, title, lede, controls, children, note, source = true }: FigureProps) {
  return (
    <section className="figure" id={id}>
      <header className="figure-head">
        <h3>{title}</h3>
        {lede ? <p className="figure-lede">{lede}</p> : null}
      </header>
      {controls ? <div className="figure-controls">{controls}</div> : null}
      <div className="figure-body">{children}</div>
      {note ? <p className="figure-note">{note}</p> : null}
      {source ? (
        <p className="figure-source">
          Source: OECD Inter-Country Input-Output tables, 2026 release; author&rsquo;s calculations.
        </p>
      ) : null}
    </section>
  )
}
