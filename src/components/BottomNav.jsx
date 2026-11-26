import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',       icon: '🏠', label: 'Home',   end: true },
  { to: '/review', icon: '📖', label: 'Review' },
  { to: '/import', icon: '📂', label: 'Import' },
  { to: '/browse', icon: '🗂',  label: 'Browse' },
  { to: '/stats',  icon: '📊', label: 'Stats' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
      <div className="flex">
        {NAV_ITEMS.map(({ to, icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
