/**
 * Method: definitions, coverage, and the caveats a reader needs before quoting a number.
 *
 * Anything the analysis cannot support is stated here rather than left to the reader to
 * discover, including the parts of the data that are modelled rather than observed.
 */

import { Figure } from '../components/Figure'
import type { ViewProps } from '../lib/view'

export function MethodView({ data }: ViewProps) {
  const { coverage, definitions, attribution, licensing_note: licensingNote } = data.metadata

  return (
    <>
      <section className="prose">
        <h2>Method and definitions</h2>
        <p>
          Everything on this site is derived from the OECD Inter-Country Input-Output tables.
          No modelling or estimation happens in the browser: the indicators are computed once,
          in Python, and the site displays them.
        </p>
      </section>

      <Figure title="How value added is attributed" source={false}>
        <div className="prose">
          <p>
            Value added is attributed by <strong>where production happened</strong>, not by who
            owns the firm. Value added created in a country, exported as an input, processed
            abroad and then re-imported still counts as that country&rsquo;s domestic value
            added. This matches the standard Leontief approach and OECD&rsquo;s published
            domestic value added in exports, which is the sum of direct, indirect and
            re-imported domestic content.
          </p>
          <p>
            Two consequences follow, and both are easy to get wrong when reading the figures.
            First, &ldquo;domestic&rdquo; does not mean &ldquo;owned by domestic firms&rdquo;.
            Second, a low domestic share does not by itself mean a country adds little value —
            it usually means it sits inside a longer supply chain.
          </p>
        </div>
      </Figure>

      <Figure title="Definitions used" source={false}>
        <dl className="definitions">
          {Object.entries(definitions).map(([key, text]) => (
            <div key={key} className="definition">
              <dt>{key.replace(/_/g, ' ')}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </Figure>

      <Figure title="Coverage and caveats" source={false}>
        <table className="kv">
          <tbody>
            <tr>
              <th>Dataset</th>
              <td>{data.metadata.dataset}</td>
            </tr>
            <tr>
              <th>Release vintage</th>
              <td>{data.metadata.release_vintage}</td>
            </tr>
            <tr>
              <th>Years covered</th>
              <td>
                {coverage.years[0]}&ndash;{coverage.years[coverage.years.length - 1]}
              </td>
            </tr>
            <tr>
              <th>Economies</th>
              <td>{coverage.economies} (including a rest-of-world aggregate)</td>
            </tr>
            <tr>
              <th>Industries</th>
              <td>{coverage.industries} ISIC Rev.4 industries</td>
            </tr>
            <tr>
              <th>Projected years</th>
              <td>{coverage.projected_years.join(', ')}</td>
            </tr>
          </tbody>
        </table>
        <p className="figure-note">{coverage.note}</p>
      </Figure>

      <Figure title="Known limitations" source={false}>
        <ul className="limitations">
          <li>
            <strong>No bilateral detail.</strong> The indicators say which sector and which
            country produced a piece of value added, but not which trading partner it came
            through. Figures here never imply a bilateral flow.
          </li>
          <li>
            <strong>Services are counted where they are produced.</strong> Service work carried
            out inside a manufacturing firm is not separately identified; it appears as
            manufacturing value added.
          </li>
          <li>
            <strong>Current prices.</strong> Value shares move with commodity and energy prices
            as well as with real activity. The OECD warns explicitly against reading nominal
            value-chain indicators as evidence of reshoring or de-risking, and the{' '}
            <a href="#/growth">prices versus volume page</a> shows why.
          </li>
          <li>
            <strong>This is not a Koopman-Wang-Wei decomposition.</strong> The stricter
            decomposition isolates double-counted and returned value added separately. We use
            the standard attribution, which is the one comparable to published TiVA figures.
          </li>
          <li>
            <strong>Small accounting residual.</strong> The published decomposition closes to
            within about 1.2 million USD per industry cell, from supply-use residuals in the
            source tables. At economy level this can aggregate to a few million dollars against
            trillions of trade.
          </li>
          <li>
            <strong>Vintage differences.</strong> Where our figures are compared against a
            published TiVA release built on an earlier vintage, individual economies can differ;
            Mexico differs materially. The vintage in the table above is the one used here.
          </li>
        </ul>
      </Figure>

      <Figure title="Source and attribution" source={false}>
        <p className="prose">{attribution}</p>
        <p className="prose caveat">{licensingNote}</p>
      </Figure>
    </>
  )
}
