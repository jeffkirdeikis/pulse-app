import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initSentry } from './lib/sentry.js'

const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))
const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))

// Initialize Sentry error tracking (before rendering)
initSentry()

const isProduction = import.meta.env.PROD

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      {isProduction && (
        <Suspense fallback={null}>
          <SpeedInsights />
          <Analytics />
        </Suspense>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
