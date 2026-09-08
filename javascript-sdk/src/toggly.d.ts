declare module '@ops-ai/feature-flags-toggly' {
}

type TogglyEntityContext = { kind: string; key: string; attributes?: Record<string, unknown> }
declare class TogglyBrowserSdk {
    static init(config: Record<string, unknown>): Promise<Record<string, boolean>>
    static refresh(): Promise<Record<string, boolean>>
    static setContext(context: { identity?: string; claims?: Record<string, string>; groups?: string[] }): Promise<Record<string, boolean>>
    static identity: string
    static claims: Record<string, string>
    static readonly evaluationContext: { identity?: string; claims?: Record<string, string>; groups?: string[] }
    static registerContext<T>(kind: string, mapper: (entity: T) => TogglyEntityContext): void
    static isFeatureOn(key: string, context?: TogglyEntityContext | Record<string, unknown> | null, kind?: string): boolean
    static evaluateFeatureGate(keys: string[], requirement?: 0 | 1, negate?: boolean, context?: TogglyEntityContext | Record<string, unknown> | null, kind?: string): boolean
    static getVariant(key: string): { name: string; configurationValue?: unknown } | null
    static readonly featureFlagsValue: Record<string, boolean>
    static readonly lastError?: string
    static cacheFeatureFlags(flags: Record<string, unknown>): void
    static cacheVariants(variants: Record<string, { enabled: boolean; variant?: string; configurationValue?: unknown }>): void
    static cancelRefreshInterval(): void
}

interface Window {
  Toggly: typeof TogglyBrowserSdk
}
