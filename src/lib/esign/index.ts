import { ESignAdapter } from './ESignAdapter'
import { DropboxSignAdapter } from './DropboxSignAdapter'
import { MockESignProvider } from './MockESignProvider'
import type { ProviderName } from './types'

export { ESignAdapter } from './ESignAdapter'
export { DropboxSignAdapter } from './DropboxSignAdapter'
export { MockESignProvider } from './MockESignProvider'
export * from './types'

const adapterRegistry: Record<ProviderName, new (apiKey?: string) => ESignAdapter> = {
  dropbox_sign: DropboxSignAdapter,
  mock: MockESignProvider,
}

export function createESignAdapter(providerName: ProviderName, apiKey?: string): ESignAdapter {
  const AdapterClass = adapterRegistry[providerName]
  if (!AdapterClass) {
    throw new Error(`Unknown e-sign provider: ${providerName}`)
  }
  return new AdapterClass(apiKey)
}
