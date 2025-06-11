import { EventEmitter } from 'events'
import TypedEmitter from 'typed-emitter'
import blocksAtlases from 'mc-assets/dist/blocksAtlases.json'
import itemsAtlases from 'mc-assets/dist/itemsAtlases.json'
import itemDefinitionsJson from 'mc-assets/dist/itemDefinitions.json'
import blocksAtlasLatest from 'mc-assets/dist/blocksAtlasLatest.png'
import blocksAtlasLegacy from 'mc-assets/dist/blocksAtlasLegacy.png'
import itemsAtlasLatest from 'mc-assets/dist/itemsAtlasLatest.png'
import itemsAtlasLegacy from 'mc-assets/dist/itemsAtlasLegacy.png'
import christmasPack from 'mc-assets/dist/textureReplacements/christmas'
import { AtlasParser } from 'mc-assets/dist/atlasParser'
import worldBlockProvider, { WorldBlockProvider } from 'mc-assets/dist/worldBlockProvider'
import { ItemsRenderer } from 'mc-assets/dist/itemsRenderer'
import { getLoadedItemDefinitionsStore } from 'mc-assets'
import { getLoadedImage } from 'mc-assets/dist/utils'
import { generateGuiAtlas } from 'renderer/viewer/lib/guiRenderer'
import { importLargeData } from '../generated/large-data-aliases'
import { loadMinecraftData } from './connect'

type ResourceManagerEvents = {
  assetsTexturesUpdated: () => void
  assetsInventoryReady: () => void
}

export class LoadedResources {
  // Atlas parsers
  itemsAtlasParser: AtlasParser
  blocksAtlasParser: AtlasParser
  itemsAtlasImage: HTMLImageElement
  blocksAtlasImage: HTMLImageElement
  // User data (specific to current resourcepack/version)
  customBlockStates?: Record<string, any>
  customModels?: Record<string, any>
  /** array where the index represents the custom model data value, and the element at that index is the model path to use */
  customItemModelNames: Record<string, string[]> = {}
  customTextures: {
    items?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    blocks?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
    armor?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> }
  } = {}

  itemsRenderer: ItemsRenderer
  worldBlockProvider: WorldBlockProvider
  blockstatesModels: any = null

  version: string
  texturesVersion: string
}

export interface ResourcesCurrentConfig {
  version: string
  texturesVersion?: string
  // noBlockstatesModels?: boolean
  noInventoryGui?: boolean
  includeOnlyBlocks?: string[]
}

export interface UpdateAssetsRequest {
  _?: false
}

const STABLE_MODELS_VERSION = '1.21.4'
export class ResourcesManager extends (EventEmitter as new () => TypedEmitter<ResourceManagerEvents>) {
  // Source data (imported, not changing)
  sourceBlockStatesModels: any = null
  readonly sourceBlocksAtlases: any = blocksAtlases
  readonly sourceItemsAtlases: any = itemsAtlases
  readonly sourceItemDefinitionsJson: any = itemDefinitionsJson
  readonly itemsDefinitionsStore = getLoadedItemDefinitionsStore(this.sourceItemDefinitionsJson)

  currentResources: LoadedResources | undefined
  currentConfig: ResourcesCurrentConfig | undefined
  abortController = new AbortController()
  _promiseAssetsReadyResolvers = Promise.withResolvers<void>()
  get promiseAssetsReady () {
    return this._promiseAssetsReadyResolvers.promise
  }

  async loadMcData (version: string) {
    await loadMinecraftData(version)
  }

  async loadSourceData (version: string) {
    await this.loadMcData(version)
    this.sourceBlockStatesModels ??= await importLargeData('blockStatesModels')
  }

  resetResources () {
    this.currentResources = new LoadedResources()
  }

  async updateAssetsData (request: UpdateAssetsRequest, unstableSkipEvent = false) {
    if (!this.currentConfig) throw new Error('No config loaded')
    this._promiseAssetsReadyResolvers = Promise.withResolvers()
    const abortController = new AbortController()
    await this.loadSourceData(this.currentConfig.version)
    if (abortController.signal.aborted) return

    const resources = this.currentResources ?? new LoadedResources()
    resources.version = this.currentConfig.version
    resources.texturesVersion = this.currentConfig.texturesVersion ?? resources.version

    resources.blockstatesModels = {
      blockstates: {},
      models: {}
    }
    // todo-low resolve version
    resources.blockstatesModels.blockstates.latest = {
      ...this.sourceBlockStatesModels.blockstates.latest,
      ...resources.customBlockStates
    }

    resources.blockstatesModels.models.latest = {
      ...this.sourceBlockStatesModels.models.latest,
      ...resources.customModels
    }

    await this.recreateBlockAtlas(resources)

    if (abortController.signal.aborted) return

    const itemsAssetsParser = new AtlasParser(this.sourceItemsAtlases, itemsAtlasLatest, itemsAtlasLegacy)
    const customItemTextures = Object.keys(resources.customTextures.items?.textures ?? {})
    console.time('createItemsAtlas')
    const { atlas: itemsAtlas, canvas: itemsCanvas } = await itemsAssetsParser.makeNewAtlas(
      resources.texturesVersion,
      (textureName) => {
        const texture = resources.customTextures.items?.textures[textureName]
        if (!texture) return
        return texture
      },
      resources.customTextures.items?.tileSize,
      undefined,
      customItemTextures
    )
    console.timeEnd('createItemsAtlas')

    resources.itemsAtlasParser = new AtlasParser({ latest: itemsAtlas }, itemsCanvas.toDataURL())
    resources.itemsAtlasImage = await getLoadedImage(itemsCanvas.toDataURL())

    if (resources.version && resources.blockstatesModels && resources.itemsAtlasParser && resources.blocksAtlasParser) {
      resources.itemsRenderer = new ItemsRenderer(
        resources.version,
        resources.blockstatesModels,
        resources.itemsAtlasParser,
        resources.blocksAtlasParser
      )
    }

    if (abortController.signal.aborted) return

    this.currentResources = resources
    if (!unstableSkipEvent) { // todo rework resourcepack optimization
      this.emit('assetsTexturesUpdated')
    }

    if (this.currentConfig.noInventoryGui) {
      this._promiseAssetsReadyResolvers.resolve()
    } else {
      void this.generateGuiTextures().then(() => {
        if (abortController.signal.aborted) return
        if (!unstableSkipEvent) {
          this.emit('assetsInventoryReady')
        }
        this._promiseAssetsReadyResolvers.resolve()
      })
    }
  }

  async recreateBlockAtlas (resources: LoadedResources = this.currentResources!) {
    const blockTexturesChanges = {} as Record<string, string>
    const date = new Date()
    if ((date.getMonth() === 11 && date.getDate() >= 24) || (date.getMonth() === 0 && date.getDate() <= 6)) {
      Object.assign(blockTexturesChanges, christmasPack)
    }

    const blocksAssetsParser = new AtlasParser(this.sourceBlocksAtlases, blocksAtlasLatest, blocksAtlasLegacy)

    const customBlockTextures = Object.keys(resources.customTextures.blocks?.textures ?? {})
    console.time('createBlocksAtlas')
    const { atlas: blocksAtlas, canvas: blocksCanvas } = await blocksAssetsParser.makeNewAtlas(
      resources.texturesVersion,
      (textureName) => {
        if (this.currentConfig!.includeOnlyBlocks && !this.currentConfig!.includeOnlyBlocks.includes(textureName)) return false
        const texture = resources.customTextures.blocks?.textures[textureName]
        return blockTexturesChanges[textureName] ?? texture
      },
      undefined,
      undefined,
      customBlockTextures,
      {
        needHorizontalIndexes: !!this.currentConfig!.includeOnlyBlocks,
      }
    )
    console.timeEnd('createBlocksAtlas')

    resources.blocksAtlasParser = new AtlasParser({ latest: blocksAtlas }, blocksCanvas.toDataURL())
    resources.blocksAtlasImage = await getLoadedImage(blocksCanvas.toDataURL())

    resources.worldBlockProvider = worldBlockProvider(
      resources.blockstatesModels,
      resources.blocksAtlasParser.atlas,
      STABLE_MODELS_VERSION
    )
  }

  async generateGuiTextures () {
    await generateGuiAtlas()
  }

  async downloadDebugAtlas (isItems = false) {
    const resources = this.currentResources
    if (!resources) throw new Error('No resources loaded')
    const atlasParser = (isItems ? resources.itemsAtlasParser : resources.blocksAtlasParser)!
    const dataUrl = await atlasParser.createDebugImage(true)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `atlas-debug-${isItems ? 'items' : 'blocks'}.png`
    a.click()
  }

  destroy () {
    this.abortController.abort()
    this.currentResources = undefined
    this.abortController = new AbortController()
  }
}
