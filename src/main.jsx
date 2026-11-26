import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import ReviewScreen from './screens/ReviewScreen.jsx'
import ImportScreen from './screens/ImportScreen.jsx'
import BrowseScreen from './screens/BrowseScreen.jsx'
import StatsScreen from './screens/StatsScreen.jsx'
import HowToScreen from './screens/HowToScreen.jsx'
import { DeckProvider } from './DeckContext.jsx'
import './index.css'

// Ask the browser not to evict IndexedDB under storage pressure. Granted silently
// for installed PWAs on Chrome, ignored where unsupported.
navigator.storage?.persist?.()

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,      element: <HomeScreen /> },
      { path: 'review',   element: <ReviewScreen /> },
      { path: 'import',   element: <ImportScreen /> },
      { path: 'browse',   element: <BrowseScreen /> },
      { path: 'stats',    element: <StatsScreen /> },
      { path: 'help',     element: <HowToScreen /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DeckProvider>
      <RouterProvider router={router} />
    </DeckProvider>
  </React.StrictMode>,
)
