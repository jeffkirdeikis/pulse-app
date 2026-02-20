import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initSentry } from './lib/sentry.js'

const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))
const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))

// Initialize Sentry error tracking (before rendering)
initSentry()

const isProduction = import.meta.env.PROD
// In production, app is served at /squamish via Vercel rewrite.
// In dev, serve from root.
const basename = isProduction ? '/squamish' : ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ErrorBoundary>
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
