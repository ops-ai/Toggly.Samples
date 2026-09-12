import { contextBridge } from 'electron'
import { exposeToggly } from '@ops-ai/electron-feature-flags-toggly/preload'

// This is the only capability the renderer gets from the SDK. The package
// exposes feature methods through contextBridge; it does not expose Node, IPC,
// disk storage, or the App Key to page JavaScript.
exposeToggly()

// A boolean status helps the teaching UI explain missing setup without leaking
// credentials. Do not add the key itself or a general IPC send/invoke method.
contextBridge.exposeInMainWorld('sampleConfiguration', {
  hasAppKey: Boolean(process.env.TOGGLY_APP_KEY?.trim() && process.env.TOGGLY_APP_KEY !== 'ci-placeholder'),
  environment: process.env.TOGGLY_ENVIRONMENT?.trim() || 'Production',
})
