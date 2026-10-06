import type { ConfigValue, CoreConfig } from './config'

export interface SettingsClient {
  load(): Promise<CoreConfig>
  save(oValues: CoreConfig): Promise<CoreConfig>
}

const validateNamespace = (sNamespace: string): string => {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(sNamespace)) {
    throw new Error('Invalid settings namespace: ' + sNamespace)
  }
  return sNamespace
}

const getRequestToken = (): string => {
  const oWindow = window as Window & { OC?: { requestToken?: string } }
  return oWindow.OC?.requestToken ?? ''
}

export const createSettingsClient = (sEndpoint: string, sNamespace: string): SettingsClient => {
  const sSafeNamespace = validateNamespace(sNamespace)
  const fnRequest = async (sMethod: 'GET' | 'PUT', oValues?: CoreConfig): Promise<CoreConfig> => {
    const oUrl = new URL(sEndpoint, window.location.href)
    oUrl.searchParams.set('namespace', sSafeNamespace)
    const oHeaders: Record<string, string> = { Accept: 'application/json' }
    const sToken = getRequestToken()
    if (sToken) oHeaders.requesttoken = sToken
    if (oValues) oHeaders['Content-Type'] = 'application/json'
    const oResponse = await fetch(oUrl.toString(), {
      method: sMethod,
      credentials: 'same-origin',
      headers: oHeaders,
      body: oValues ? JSON.stringify({ values: oValues }) : undefined,
    })
    if (!oResponse.ok) throw new Error('Settings request failed with HTTP ' + oResponse.status + '.')
    const oPayload = await oResponse.json() as { values?: Record<string, ConfigValue> }
    return Object.freeze({ ...(oPayload.values ?? {}) })
  }
  return Object.freeze({
    load: () => fnRequest('GET'),
    save: (oValues: CoreConfig) => fnRequest('PUT', oValues),
  })
}

export const settings = Object.freeze({ create: createSettingsClient })
