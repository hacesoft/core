import { Config } from './config'
import { EventBus } from './event-bus'
import { createLogger } from './logger'
import { API_VERSION, CORE_VERSION, isVersionAtLeast } from './version'
import { workspace } from './workspace'
import { dialogs } from './dialogs'
import { notifications } from './notifications'
import { toolbar } from './toolbar'
import { forms } from './forms'
import { settings } from './settings'
import { picker } from './picker'
import { layout } from './layout'
import { about, updates } from './about'
import { maps } from './maps'
import { mapFavorites } from './map-favorites'
import { editor } from './editor'
import { lists } from './lists'
import { background } from './background'
import { concurrency } from './concurrency'

const mapsApi = Object.freeze({ ...maps, favorites: mapFavorites })

export { Config, EventBus, createLogger, API_VERSION, CORE_VERSION, isVersionAtLeast, workspace, dialogs, notifications, toolbar, forms, settings, picker, layout, about, updates, mapsApi as maps, editor, lists, background, concurrency }

export interface HcSharedAppCoreApi {
  readonly version: string
  readonly apiVersion: number
  readonly events: EventBus
  readonly config: Config
  readonly logger: ReturnType<typeof createLogger>
  readonly workspace: typeof workspace
  readonly dialogs: typeof dialogs
  readonly notifications: typeof notifications
  readonly toolbar: typeof toolbar
  readonly forms: typeof forms
  readonly settings: typeof settings
  readonly picker: typeof picker
  readonly layout: typeof layout
  readonly about: typeof about
  readonly updates: typeof updates
  readonly maps: typeof mapsApi
  readonly editor: typeof editor
  readonly lists: typeof lists
  readonly background: typeof background
  readonly concurrency: typeof concurrency
  assertCompatible(minimumVersion: string): void
}

const api: HcSharedAppCoreApi = Object.freeze({
  version: CORE_VERSION,
  apiVersion: API_VERSION,
  events: new EventBus(),
  config: new Config(),
  logger: createLogger('hc_shared_app_core'),
  workspace,
  dialogs,
  notifications,
  toolbar,
  forms,
  settings,
  picker,
  layout,
  about,
  updates,
  maps: mapsApi,
  editor,
  lists,
  background,
  concurrency,
  assertCompatible(minimumVersion: string): void {
    if (!isVersionAtLeast(CORE_VERSION, minimumVersion)) {
      throw new Error(
        'Shared App Core ' + minimumVersion
          + ' or newer is required; ' + CORE_VERSION + ' is loaded.',
      )
    }
  },
})

declare global {
  interface Window {
    HcSharedAppCore: HcSharedAppCoreApi
  }
}

window.HcSharedAppCore = api
