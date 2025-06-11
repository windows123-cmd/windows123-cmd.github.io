import { proxy, ref, subscribe } from 'valtio'
import { UserOverridesConfig } from 'contro-max/build/types/store'
import { subscribeKey } from 'valtio/utils'
import { AppConfig } from '../appConfig'
import { CustomCommand } from './KeybindingsCustom'
import { AuthenticatedAccount } from './serversStorage'
import type { BaseServerInfo } from './AddServerOrConnect'

// when opening html file locally in browser, localStorage is shared between all ever opened html files, so we try to avoid conflicts
const localStoragePrefix = process.env?.SINGLE_FILE_BUILD ? 'minecraft-web-client:' : ''
const { localStorage } = window

export interface SavedProxiesData {
  proxies: string[]
  selected: string
}

export interface ServerHistoryEntry {
  ip: string
  version?: string
  numConnects: number
  lastConnected: number
}

export interface StoreServerItem extends BaseServerInfo {
  lastJoined?: number
  description?: string
  optionsOverride?: Record<string, any>
  autoLogin?: Record<string, string>
  numConnects?: number // Track number of connections
}

type StorageData = {
  customCommands: Record<string, CustomCommand> | undefined
  username: string | undefined
  keybindings: UserOverridesConfig | undefined
  /** @deprecated */
  options: any
  changedSettings: any
  proxiesData: SavedProxiesData | undefined
  serversHistory: ServerHistoryEntry[]
  authenticatedAccounts: AuthenticatedAccount[]
  serversList: StoreServerItem[] | undefined
  modsAutoUpdateLastCheck: number | undefined
  firstModsPageVisit: boolean
}

const oldKeysAliases: Partial<Record<keyof StorageData, string>> = {
  serversHistory: 'serverConnectionHistory',
}

const migrateLegacyData = () => {
  const proxies = localStorage.getItem('proxies')
  const selectedProxy = localStorage.getItem('selectedProxy')
  if (proxies && selectedProxy) {
    appStorage.proxiesData = {
      proxies: JSON.parse(proxies),
      selected: selectedProxy,
    }
  }

  const username = localStorage.getItem('username')
  if (username && !username.startsWith('"')) {
    appStorage.username = username
  }

  const serversHistoryLegacy = localStorage.getItem('serverConnectionHistory')
  if (serversHistoryLegacy) {
    appStorage.serversHistory = JSON.parse(serversHistoryLegacy)
  }
  localStorage.removeItem('proxies')
  localStorage.removeItem('selectedProxy')
  localStorage.removeItem('serverConnectionHistory')
}

const defaultStorageData: StorageData = {
  customCommands: undefined,
  username: undefined,
  keybindings: undefined,
  options: {},
  changedSettings: {},
  proxiesData: undefined,
  serversHistory: [],
  authenticatedAccounts: [],
  serversList: undefined,
  modsAutoUpdateLastCheck: undefined,
  firstModsPageVisit: true,
}

export const setStorageDataOnAppConfigLoad = (appConfig: AppConfig) => {
  appStorage.username ??= getRandomUsername(appConfig)
}

export const getRandomUsername = (appConfig: AppConfig) => {
  return appConfig.defaultUsername?.replaceAll('{num}', () => Math.floor(Math.random() * 10).toString()) ?? ''
}

export const appStorage = proxy({ ...defaultStorageData })

// Restore data from localStorage
for (const key of Object.keys(defaultStorageData)) {
  const prefixedKey = `${localStoragePrefix}${key}`
  const aliasedKey = oldKeysAliases[key]
  const storedValue = localStorage.getItem(prefixedKey) ?? (aliasedKey ? localStorage.getItem(aliasedKey) : undefined)
  if (storedValue) {
    try {
      const parsed = JSON.parse(storedValue)
      // appStorage[key] = parsed && typeof parsed === 'object' ? ref(parsed) : parsed
      appStorage[key] = parsed
    } catch (e) {
      console.error(`Failed to parse stored value for ${key}:`, e)
    }
  }
}

const saveKey = (key: keyof StorageData) => {
  const prefixedKey = `${localStoragePrefix}${key}`
  const value = appStorage[key]
  if (value === undefined) {
    localStorage.removeItem(prefixedKey)
  } else {
    localStorage.setItem(prefixedKey, JSON.stringify(value))
  }
}

subscribe(appStorage, (ops) => {
  for (const op of ops) {
    const [type, path, value] = op
    const key = path[0]
    saveKey(key as keyof StorageData)
  }
})
// Subscribe to changes and save to localStorage

export const resetAppStorage = () => {
  for (const key of Object.keys(appStorage)) {
    appStorage[key as keyof StorageData] = defaultStorageData[key as keyof StorageData]
  }

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(localStoragePrefix)) {
      localStorage.removeItem(key)
    }
  }
}

migrateLegacyData()
