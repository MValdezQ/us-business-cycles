import {
  SAMPLE_ORDER,
  SERIES_LABELS_FULL,
  SERIES_ORDER,
} from '../lib/artifact';
import type { Artifact, SampleId, SeriesId } from '../lib/artifact-types';
import { quarterLabel } from '../lib/format';

export function SeriesSelector({
  artifact: _artifact,
  value,
  onChange,
  multi,
  selected,
  onToggle,
}: {
  artifact: Artifact;
  value: SeriesId;
  onChange: (id: SeriesId) => void;
  multi: boolean;
  selected: SeriesId[];
  onToggle: (id: SeriesId) => void;
}) {
  const categories = ['Per-Capita Quantities', 'Factor Prices & Rates', 'Prices & Technology'];
  return (
    <fieldset className="selector">
      <legend>
        Series
        {multi && <span className="hint"> — compare up to 4 on the cycle view</span>}
      </legend>
      {categories.map((cat) => (
        <div className="series-group" key={cat}>
          <span className="group-label">{cat}</span>
          <div className="chips">
            {SERIES_ORDER.filter((id) => SERIES_LABELS_FULL[id].category === cat).map((id) => {
              const on = multi ? selected.includes(id) : value === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => (multi ? onToggle(id) : onChange(id))}
                >
                  {SERIES_LABELS_FULL[id].short}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

export function SampleSelector({
  artifact,
  value,
  onChange,
  note,
}: {
  artifact: Artifact;
  value: SampleId;
  onChange: (s: SampleId) => void;
  note?: string;
}) {
  return (
    <fieldset className="selector">
      <legend>Sample</legend>
      <div className="chips">
        {SAMPLE_ORDER.map((s) => {
          const d = artifact.sample_definitions[s];
          return (
            <button
              key={s}
              type="button"
              className={`chip${value === s ? ' on' : ''}`}
              aria-pressed={value === s}
              onClick={() => onChange(s)}
              title={`${quarterLabel(d.start)}–${quarterLabel(d.end)}, ${d.n_quarters} quarters`}
            >
              {d.name.replace('Sample ', '')}
            </button>
          );
        })}
      </div>
      {note && <p className="blurb">{note}</p>}
    </fieldset>
  );
}
