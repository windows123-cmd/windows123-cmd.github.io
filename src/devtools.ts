// global variables useful for debugging

import fs from 'fs'
import { WorldRendererThree } from 'renderer/viewer/three/worldrendererThree'
import { enable, disable, enabled } from 'debug'
import { Vec3 } from 'vec3'

window.Vec3 = Vec3
window.cursorBlockRel = (x = 0, y = 0, z = 0) => {
  const newPos = bot.blockAtCursor(5)?.position.offset(x, y, z)
  if (!newPos) return
  return bot.world.getBlock(newPos)
}

window.entityCursor = () => {
  return bot.mouse.getCursorState().entity
}

// wanderer
window.inspectPlayer = () => require('fs').promises.readFile('/world/playerdata/9e487d23-2ffc-365a-b1f8-f38203f59233.dat').then(window.nbt.parse).then(console.log)

Object.defineProperty(window, 'debugSceneChunks', {
  get () {
    if (!(window.world instanceof WorldRendererThree)) return undefined
    return (window.world)?.getLoadedChunksRelative?.(bot.entity.position, true)
  },
})

window.chunkKey = (xRel = 0, zRel = 0) => {
  const pos = bot.entity.position
  return `${(Math.floor(pos.x / 16) + xRel) * 16},${(Math.floor(pos.z / 16) + zRel) * 16}`
}

window.sectionKey = (xRel = 0, yRel = 0, zRel = 0) => {
  const pos = bot.entity.position
  return `${(Math.floor(pos.x / 16) + xRel) * 16},${(Math.floor(pos.y / 16) + yRel) * 16},${(Math.floor(pos.z / 16) + zRel) * 16}`
}

window.keys = (obj) => Object.keys(obj)
window.values = (obj) => Object.values(obj)

window.len = (obj) => Object.keys(obj).length

customEvents.on('gameLoaded', () => {
  bot._client.on('packet', (data, { name }) => {
    if (sessionStorage.ignorePackets?.includes(name)) {
      console.log('ignoring packet', name)
      const oldEmit = bot._client.emit
      let i = 0
      // ignore next 3 emits
      //@ts-expect-error
      bot._client.emit = (...args) => {
        if (i++ === 3) {
          oldEmit.apply(bot._client, args)
          bot._client.emit = oldEmit
        }
      }
    }
  })
})

window.inspectPacket = (packetName, isFromClient = false, fullOrListener: boolean | ((...args) => void) = false) => {
  if (typeof isFromClient === 'function') {
    fullOrListener = isFromClient
    isFromClient = false
  }
  const listener = typeof fullOrListener === 'function'
    ? (name, ...args) => fullOrListener(...args, name)
    : (name, ...args) => {
      const displayName = name === packetName ? name : `${name} (${packetName})`
      console.log('packet', displayName, fullOrListener ? args : args[0])
    }

  // Pre-compile regex if using wildcards
  const pattern = typeof packetName === 'string' && packetName.includes('*')
    ? new RegExp('^' + packetName.replaceAll('*', '.*') + '$')
    : null

  const packetNameListener = (name, data) => {
    if (pattern) {
      if (pattern.test(name)) {
        listener(name, data)
      }
    } else if (name === packetName) {
      listener(name, data)
    }
  }
  const packetListener = (data, { name }) => {
    packetNameListener(name, data)
  }

  const attach = () => {
    if (isFromClient) {
      bot?._client.prependListener('writePacket', packetNameListener)
    } else {
      bot?._client.prependListener('packet_name', packetNameListener)
      bot?._client.prependListener('packet', packetListener)
    }
  }
  const detach = () => {
    if (isFromClient) {
      bot?._client.removeListener('writePacket', packetNameListener)
    } else {
      bot?._client.removeListener('packet_name', packetNameListener)
      bot?._client.removeListener('packet', packetListener)
    }
  }
  attach()
  customEvents.on('mineflayerBotCreated', attach)

  const returnobj = {}
  Object.defineProperty(returnobj, 'detach', {
    get () {
      detach()
      customEvents.removeListener('mineflayerBotCreated', attach)
      return true
    },
  })
  return returnobj
}

window.downloadFile = async (path: string) => {
  if (!path.startsWith('/') && localServer) path = `${localServer.options.worldFolder}/${path}`
  const data = await fs.promises.readFile(path)
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = path.split('/').at(-1)!
  a.click()
  URL.revokeObjectURL(url)
}

Object.defineProperty(window, 'debugToggle', {
  get () {
    localStorage.debug = localStorage.debug === '*' ? '' : '*'
    if (enabled('*')) {
      disable()
      return 'disabled debug'
    } else {
      enable('*')
      return 'enabled debug'
    }
  },
  set (v) {
    enable(v)
    localStorage.debug = v
    console.log('Enabled debug for', v)
  }
})

customEvents.on('gameLoaded', () => {
  window.holdingBlock = (window.world as WorldRendererThree | undefined)?.holdingBlock
})

window.clearStorage = (...keysToKeep: string[]) => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && !keysToKeep.includes(key)) {
      localStorage.removeItem(key)
    }
  }
  return `Cleared ${localStorage.length - keysToKeep.length} items from localStorage. Kept: ${keysToKeep.join(', ')}`
}


// PERF DEBUG

// for advanced debugging, use with watch expression

window.statsPerSecAvg = {}
let currentStatsPerSec = {} as Record<string, number[]>
const waitingStatsPerSec = {}
window.markStart = (label) => {
  waitingStatsPerSec[label] ??= []
  waitingStatsPerSec[label][0] = performance.now()
}
window.markEnd = (label) => {
  if (!waitingStatsPerSec[label]?.[0]) return
  currentStatsPerSec[label] ??= []
  currentStatsPerSec[label].push(performance.now() - waitingStatsPerSec[label][0])
  delete waitingStatsPerSec[label]
}
const updateStatsPerSecAvg = () => {
  window.statsPerSecAvg = Object.fromEntries(Object.entries(currentStatsPerSec).map(([key, value]) => {
    return [key, {
      avg: value.reduce((a, b) => a + b, 0) / value.length,
      count: value.length
    }]
  }))
  currentStatsPerSec = {}
}


window.statsPerSec = {}
let statsPerSecCurrent = {}
let lastReset = performance.now()
window.addStatPerSec = (name) => {
  statsPerSecCurrent[name] ??= 0
  statsPerSecCurrent[name]++
}
window.statsPerSecCurrent = statsPerSecCurrent
setInterval(() => {
  window.statsPerSec = { duration: Math.floor(performance.now() - lastReset), ...statsPerSecCurrent, }
  statsPerSecCurrent = {}
  window.statsPerSecCurrent = statsPerSecCurrent
  updateStatsPerSecAvg()
  lastReset = performance.now()
}, 1000)

// ---
