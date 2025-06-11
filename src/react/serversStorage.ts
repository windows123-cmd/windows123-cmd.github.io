import { appQueryParams } from '../appParams'
import { miscUiState } from '../globalState'
import { BaseServerInfo } from './AddServerOrConnect'
import { lastConnectOptions } from './AppStatusProvider'
import { appStorage, StoreServerItem } from './appStorageProvider'

const serversListQs = appQueryParams.serversList

export interface AuthenticatedAccount {
  // type: 'microsoft'
  username: string
  cachedTokens?: {
    data: any
    expiresOn: number
  }
}

export interface ServerConnectionHistory {
  ip: string
  numConnects: number
  lastConnected: number
  version?: string
}

export function updateServerConnectionHistory (ip: string, version?: string) {
  try {
    const history = [...(appStorage.serversHistory ?? [])]
    const existingServer = history.find(s => s.ip === ip)
    if (existingServer) {
      existingServer.numConnects++
      existingServer.lastConnected = Date.now()
      if (version) existingServer.version = version
    } else {
      history.push({
        ip,
        numConnects: 1,
        lastConnected: Date.now(),
        version
      })
    }
    appStorage.serversHistory = history
  } catch (err) {
    console.error('Failed to update server connection history:', err)
  }
}

export const getServerIndex = () => {
  const lastConnectedIp = lastConnectOptions.value?.server
  const index = miscUiState.loadedServerIndex
  if (index !== undefined) return index
  if (lastConnectedIp) {
    const idx = appStorage.serversList?.findIndex(s => s.ip === lastConnectedIp).toString()
    if (idx === '-1') return undefined
    return idx
  }
  return undefined
}

export const findServerPassword = () => {
  const { username } = bot
  const index = getServerIndex()
  if (index === undefined) return
  const pswd = appStorage.serversList?.[index]?.autoLogin?.[username]
  if (pswd) return pswd
  // try other servers with same host
  return appStorage.serversList?.find(s => s.ip === lastConnectOptions.value?.server && s.autoLogin?.[username])?.autoLogin?.[username]
}

export const updateLoadedServerData = (callback: (data: StoreServerItem) => StoreServerItem, index = miscUiState.loadedServerIndex) => {
  if (index === undefined) {
    const idx = getServerIndex()
    if (idx === undefined) return
    index = idx
  }

  const servers = [...(appStorage.serversList ?? [])]
  const server = servers[index]
  if (!server) return
  servers[index] = callback(server)
  setNewServersList(servers)
}

export const setNewServersList = (serversList: StoreServerItem[], force = false) => {
  if (serversListQs && !force) return
  appStorage.serversList = serversList
}

export const getInitialServersList = () => {
  // If we already have servers in appStorage, use those
  if (appStorage.serversList) return appStorage.serversList

  const servers = [] as StoreServerItem[]

  if (servers.length === 0) {
    // server list is empty, let's suggest some
    for (const server of miscUiState.appConfig?.promoteServers ?? []) {
      servers.push({
        ip: server.ip,
        description: server.description,
        versionOverride: server.version,
      })
    }
  }

  return servers
}

export const updateAuthenticatedAccountData = (callback: (data: AuthenticatedAccount[]) => AuthenticatedAccount[]) => {
  const accounts = appStorage.authenticatedAccounts
  const newAccounts = callback(accounts)
  appStorage.authenticatedAccounts = newAccounts
}

export function getServerConnectionHistory (): ServerConnectionHistory[] {
  return appStorage.serversHistory ?? []
}
