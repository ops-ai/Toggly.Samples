import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createTogglyProvider, registerContext } from '@ops-ai/react-feature-flags-toggly'
import './index.css'
import App from './App.tsx'
import { createProviderOptions, createSessionIdentity, mapOrderContext, type Order } from './sample-config'

const appKey = import.meta.env.VITE_TOGGLY_APP_KEY
const environment = import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production'
const initialIdentity = createSessionIdentity(sessionStorage)

// Register this mapper once at the app boundary. Every evaluation still carries its own Order.
registerContext<Order>('Order', mapOrderContext)
const TogglyProvider = await createTogglyProvider(createProviderOptions(appKey, environment, initialIdentity))

createRoot(document.getElementById('root')!).render(
  <StrictMode><TogglyProvider><App appKey={appKey} initialIdentity={initialIdentity} /></TogglyProvider></StrictMode>,
)
