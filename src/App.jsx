import { Outlet } from 'react-router-dom'
import BottomNav from './components/BottomNav.jsx'

export default function App() {
  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
