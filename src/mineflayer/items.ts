import mojangson from 'mojangson'
import nbt from 'prismarine-nbt'
import { fromFormattedString } from '@xmcl/text-component'
import { ItemSpecificContextProperties } from 'renderer/viewer/lib/basePlayerState'
import { getItemDefinition } from 'mc-assets/dist/itemDefinitions'
import { MessageFormatPart } from '../chatUtils'
import { ResourcesManager } from '../resourcesManager'
import { playerState } from './playerState'

type RenderSlotComponent = {
  type: string,
  data: any
  // example
  // {
  //   "type": "item_model",
  //   "data": "aa:ss"
  // }
}
export type RenderItem = Pick<import('prismarine-item').Item, 'name' | 'displayName' | 'durabilityUsed' | 'maxDurability' | 'enchants' | 'nbt'> & {
  components?: RenderSlotComponent[],
  // componentMap?: Map<string, RenderSlotComponent>
}
export type GeneralInputItem = Pick<import('prismarine-item').Item, 'name' | 'nbt'> & {
  components?: RenderSlotComponent[],
  displayName?: string
  modelResolved?: boolean
}

type JsonString = string
type PossibleItemProps = {
  CustomModelData?: number
  Damage?: number
  display?: { Name?: JsonString } // {"text":"Knife","color":"white","italic":"true"}
}

export const getItemMetadata = (item: GeneralInputItem, resourcesManager: ResourcesManager) => {
  let customText = undefined as string | any | undefined
  let customModel = undefined as string | undefined

  let itemId = item.name
  if (!itemId.includes(':')) {
    itemId = `minecraft:${itemId}`
  }
  const customModelDataDefinitions = resourcesManager.currentResources?.customItemModelNames[itemId]

  if (item.components) {
    const componentMap = new Map<string, RenderSlotComponent>()
    for (const component of item.components) {
      componentMap.set(component.type, component)
    }

    const customTextComponent = componentMap.get('custom_name') || componentMap.get('item_name')
    if (customTextComponent) {
      customText = typeof customTextComponent.data === 'string' ? customTextComponent.data : nbt.simplify(customTextComponent.data)
    }
    const customModelComponent = componentMap.get('item_model')
    if (customModelComponent) {
      customModel = customModelComponent.data
    }
    if (customModelDataDefinitions) {
      const customModelDataComponent: any = componentMap.get('custom_model_data')
      if (customModelDataComponent?.data && typeof customModelDataComponent.data === 'number') {
        const customModelData = customModelDataComponent.data
        if (customModelDataDefinitions[customModelData]) {
          customModel = customModelDataDefinitions[customModelData]
        }
      }
    }
    const loreComponent = componentMap.get('lore')
    if (loreComponent) {
      customText ??= item.displayName ?? item.name
      // todo test
      customText += `\n${JSON.stringify(loreComponent.data)}`
    }
  }
  if (item.nbt) {
    const itemNbt: PossibleItemProps = nbt.simplify(item.nbt)
    const customName = itemNbt.display?.Name
    if (customName) {
      customText = customName
    }
    if (customModelDataDefinitions && itemNbt.CustomModelData && customModelDataDefinitions[itemNbt.CustomModelData]) {
      customModel = customModelDataDefinitions[itemNbt.CustomModelData]
    }
  }

  return {
    customText,
    customModel
  }
}


export const getItemNameRaw = (item: Pick<import('prismarine-item').Item, 'nbt'> | null, resourcesManager: ResourcesManager) => {
  if (!item) return ''
  const { customText } = getItemMetadata(item as GeneralInputItem, resourcesManager)
  if (!customText) return
  try {
    if (typeof customText === 'object') {
      return customText
    }
    const parsed = customText.startsWith('{') && customText.endsWith('}') ? mojangson.simplify(mojangson.parse(customText)) : fromFormattedString(customText)
    if (parsed.extra) {
      return parsed as Record<string, any>
    } else {
      return parsed as MessageFormatPart
    }
  } catch (err) {
    return {
      text: JSON.stringify(customText)
    }
  }
}

export const getItemModelName = (item: GeneralInputItem, specificProps: ItemSpecificContextProperties, resourcesManager: ResourcesManager) => {
  let itemModelName = item.name
  const { customModel } = getItemMetadata(item, resourcesManager)
  if (customModel) {
    itemModelName = customModel
  }

  const itemSelector = playerState.getItemSelector({
    ...specificProps
  })
  const modelFromDef = getItemDefinition(appViewer.resourcesManager.itemsDefinitionsStore, {
    name: itemModelName,
    version: appViewer.resourcesManager.currentResources!.version,
    properties: itemSelector
  })?.model
  const model = (modelFromDef === 'minecraft:special' ? undefined : modelFromDef) ?? itemModelName
  return model
}
