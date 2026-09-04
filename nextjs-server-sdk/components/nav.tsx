import Link from 'next/link'

const SECTIONS = [
  {
    label: 'Home',
    links: [['/', 'Overview']] as const,
  },
  {
    label: 'Server',
    links: [
      ['/server', 'Index'],
      ['/server/components', 'Components'],
      ['/server/programmatic', 'Programmatic'],
      ['/server/actions', 'Actions'],
      ['/server/cache', 'Cache'],
      ['/server/identity', 'Identity'],
      ['/server/dashboard', 'Dashboard'],
      ['/server/api-demo', 'API'],
      ['/server/orders', 'Orders'],
      ['/server/filters', 'Filters'],
    ] as const,
  },
  {
    label: 'Client',
    links: [
      ['/client', 'Index'],
      ['/client/hooks', 'Hooks'],
      ['/client/components', 'Components'],
      ['/client/filters', 'Filters'],
    ] as const,
  },
  {
    label: 'Edge',
    links: [
      ['/edge', 'Index'],
      ['/edge/beta', 'Beta'],
      ['/edge/waitlist', 'Waitlist'],
    ] as const,
  },
] as const

export function Nav() {
  return (
    <nav>
      {SECTIONS.map((section) => (
        <div key={section.label} className="nav-section">
          <span className="nav-label">{section.label}</span>
          {section.links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
