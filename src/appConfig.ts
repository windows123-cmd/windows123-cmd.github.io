import { defaultsDeep } from 'lodash'
import { disabledSettings, options, qsOptions } from './optionsStorage'
import { miscUiState } from './globalState'
import { setLoadingScreenStatus } from './appStatus'
import { setStorageDataOnAppConfigLoad } from './react/appStorageProvider'
import { customKeymaps, updateBinds } from './controls'

export type CustomAction = {
  readonly type: string
  readonly input: readonly any[]
}

export type ActionType = string | CustomAction

export type ActionHoldConfig = {
  readonly command: ActionType
  readonly longPressAction?: ActionType
  readonly duration?: number
  readonly threshold?: number
}

export type MobileButtonConfig = {
  readonly label?: string
  readonly icon?: string
  readonly action?: ActionType
  readonly actionHold?: ActionType | ActionHoldConfig
}

export type AppConfig = {
  // defaultHost?: string
  // defaultHostSave?: string
  defaultProxy?: string
  // defaultProxySave?: string
  // defaultVersion?: string
  peerJsServer?: string
  peerJsServerFallback?: string
  promoteServers?: Array<{ ip, description, version? }>
  mapsProvider?: string

  appParams?: Record<string, any> // query string params
  rightSideText?: string

  defaultSettings?: Record<string, any>
  forceSettings?: Record<string, boolean>
  // hideSettings?: Record<string, boolean>
  allowAutoConnect?: boolean
  splashText?: string
  splashTextFallback?: string
  pauseLinks?: Array<Array<Record<string, any>>>
  mobileButtons?: MobileButtonConfig[]
  keybindings?: Record<string, any>
  defaultLanguage?: string
  displayLanguageSelector?: boolean
  supportedLanguages?: string[]
  showModsButton?: boolean
  defaultUsername?: string
}

export const loadAppConfig = (appConfig: AppConfig) => {
  if (miscUiState.appConfig) {
    Object.assign(miscUiState.appConfig, appConfig)
  } else {
    miscUiState.appConfig = appConfig
  }

  if (appConfig.forceSettings) {
    for (const [key, value] of Object.entries(appConfig.forceSettings)) {
      if (value) {
        disabledSettings.value.add(key)
        // since the setting is forced, we need to set it to that value
        if (appConfig.defaultSettings?.[key] && !qsOptions[key]) {
          options[key] = appConfig.defaultSettings[key]
        }
      } else {
        disabledSettings.value.delete(key)
      }
    }
  }

  if (appConfig.keybindings) {
    Object.assign(customKeymaps, defaultsDeep(appConfig.keybindings, customKeymaps))
    updateBinds(customKeymaps)
  }

  setStorageDataOnAppConfigLoad(appConfig)
}

export const isBundledConfigUsed = !!process.env.INLINED_APP_CONFIG

if (isBundledConfigUsed) {
  loadAppConfig(process.env.INLINED_APP_CONFIG as AppConfig ?? {})
} else {
  void window.fetch('config.json').then(async res => res.json()).then(c => c, (error) => {
  // console.warn('Failed to load optional app config.json', error)
  // return {}
    setLoadingScreenStatus('Failed to load app config.json', true)
  }).then((config: AppConfig) => {
    loadAppConfig(config)
  })
}
