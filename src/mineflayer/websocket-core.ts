import { Duplex } from 'stream'
import { UserError } from './userError'

class CustomDuplex extends Duplex {
  constructor (options, public writeAction) {
    super(options)
  }

  override _read () {}

  override _write (chunk, encoding, callback) {
    this.writeAction(chunk)
    callback()
  }
}

export const getWebsocketStream = async (host: string) => {
  const baseProtocol = location.protocol === 'https:' ? 'wss' : host.startsWith('ws://') ? 'ws' : 'wss'
  const hostClean = host.replace('ws://', '').replace('wss://', '')
  const ws = new WebSocket(`${baseProtocol}://${hostClean}`)
  const clientDuplex = new CustomDuplex(undefined, data => {
    ws.send(data)
  })

  ws.addEventListener('message', async message => {
    let { data } = message
    if (data instanceof Blob) {
      data = await data.arrayBuffer()
    }
    clientDuplex.push(Buffer.from(data))
  })

  ws.addEventListener('close', () => {
    console.log('ws closed')
    clientDuplex.end()
    setTimeout(() => {
      clientDuplex.emit('end', 'Connection lost')
    }, 500)
  })

  ws.addEventListener('error', err => {
    console.log('ws error', err)
    clientDuplex.emit('error', err)
  })

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', err => {
      console.log('ws error', err)
      reject(new UserError('Failed to open websocket connection'))
    })
  })

  return {
    mineflayerStream: clientDuplex,
    ws,
  }
}
