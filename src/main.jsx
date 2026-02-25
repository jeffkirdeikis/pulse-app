import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initSentry } from './lib/sentry.js'

const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))
const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))

// Initialize Sentry error tracking (before rendering)
initSentry()

// Track SPA page views in Google Analytics
function GaPageTracker() {
  const location = useLocation()
  useEffect(() => {
    if (window.gtag) {
      window.gtag('event', 'page_view', { page_path: location.pathname + location.search })
    }
  }, [location])
  return null
}

const isProduction = import.meta.env.PROD
// In production, app is served at /squamish via Vercel rewrite.
// In dev, serve from root.
const basename = isProduction ? '/squamish' : ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ErrorBoundary>
        <GaPageTracker />
        <App />
        {isProduction && (
          <Suspense fallback={null}>
            <SpeedInsights />
            <Analytics />
          </Suspense>
        )}
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
