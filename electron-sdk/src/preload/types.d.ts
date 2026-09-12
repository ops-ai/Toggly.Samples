export {}

declare global {
  interface Window {
    sampleConfiguration: {
      hasAppKey: boolean
      environment: string
    }
  }
}
