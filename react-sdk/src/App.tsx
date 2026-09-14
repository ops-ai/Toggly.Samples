import './App.css'
import { MissingAppKeyBanner } from './MissingAppKeyBanner'
import { DeclarativeGates, FiltersMatrix, IdentityPanel, OrderContextPanel, ProgrammaticApi, ReactSurfaces, Snapshot } from './DemoPanels'

type AppProps = { appKey: string | undefined; initialIdentity: string }

export default function App({ appKey, initialIdentity }: AppProps) {
  return <>
    <header>
      <p className="eyebrow">@ops-ai/react-feature-flags-toggly</p>
      <h1>React SDK Showcase</h1>
      <p className="lede">A guided, browser-first Toggly app. Follow configuration → provider → one flag check before adding identity, Order context, and filter rules.</p>
      <nav aria-label="Showcase sections"><a href="#declarative">Gates</a><a href="#programmatic">API</a><a href="#identity">Identity</a><a href="#order">Order</a><a href="#filters">Filters</a><a href="#surfaces">React surfaces</a></nav>
    </header>
    <main>
      <MissingAppKeyBanner appKey={appKey} />
      <section className="card" id="home">
        <h2>Home: your first toggle</h2>
        <ol>
          <li>Create <strong>React SDK Sample</strong> and add its app key to <code>.env.local</code>.</li>
          <li>Turn <code>new-dashboard</code> on in Production, refresh this page, and find the green branch below.</li>
          <li>Turn it off, refresh again, and find the explicit <code>negate</code> branch.</li>
        </ol>
        <p className="muted">An app key identifies evaluated definitions; it is not a management API credential or an authorization boundary.</p>
      </section>
      <Snapshot /><DeclarativeGates /><ProgrammaticApi /><IdentityPanel initialIdentity={initialIdentity} /><OrderContextPanel /><FiltersMatrix /><ReactSurfaces />
    </main>
  </>
}
