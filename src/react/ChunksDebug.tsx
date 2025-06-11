import { useEffect, useRef, useState } from 'react'
import './LoadingChunks.css'

export interface ChunkDebug {
  x: number // like -32
  z: number // like -32
  lines: string[]
  sidebarLines: string[]
  state: 'server-waiting' | 'order-queued' | 'client-waiting' | 'client-processing' | 'done-empty' | 'done'
}

interface ProcessedChunk extends ChunkDebug {
  relX: number
  relZ: number
  displayLines: string[]
}

const stateColors: Record<ChunkDebug['state'], string> = {
  'server-waiting': 'gray',
  'order-queued': 'darkorange',
  'client-waiting': 'yellow',
  'client-processing': 'yellow',
  'done-empty': 'darkgreen',
  'done': 'limegreen',
}

export default ({
  chunks,
  playerChunk,
  maxDistance,
  tileSize = 16,
  fontSize = 5,
}: {
  chunks: ChunkDebug[]
  playerChunk: { x: number, z: number }
  maxDistance: number,
  tileSize?: number
  fontSize?: number
}) => {
  const [selectedChunk, setSelectedChunk] = useState<ProcessedChunk | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  // Calculate grid dimensions based on maxDistance
  const gridSize = maxDistance * 2 + 1
  const centerIndex = maxDistance

  // Process chunks to get only the last one for each position and within maxDistance
  const processedChunks = chunks.reduce<Record<string, ProcessedChunk>>((acc, chunk) => {
    const relX = Math.floor((chunk.x - playerChunk.x) / 16)
    const relZ = Math.floor((chunk.z - playerChunk.z) / 16)

    // Skip chunks outside maxDistance
    if (Math.abs(relX) > maxDistance || Math.abs(relZ) > maxDistance) return acc

    const key = `${chunk.x},${chunk.z}`
    acc[key] = {
      ...chunk,
      relX,
      relZ,
      displayLines: [`${relX},${relZ} (${chunk.x},${chunk.z})`, ...chunk.lines]
    }
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        gap: 1,
        // width: `${tileSize * gridSize}px`,
        // height: `${tileSize * gridSize}px`,
      }}>
        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
          const relX = -maxDistance + (i % gridSize)
          const relZ = -maxDistance + Math.floor(i / gridSize)
          const x = playerChunk.x + relX * 16
          const z = playerChunk.z + relZ * 16
          const chunk = processedChunks[`${x},${z}`]

          return (
            <div
              key={`${x},${z}`}
              onClick={() => {
                if (chunk) {
                  setSelectedChunk(chunk)
                  setShowSidebar(true)
                }
              }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: chunk ? stateColors[chunk.state] : 'black',
                color: 'white',
                fontSize: `${fontSize}px`,
                cursor: chunk ? 'pointer' : 'default',
                position: 'relative',
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                // pre-wrap
                whiteSpace: 'pre',
              }}
            >
              {relX}, {relZ}{'\n'}
              {chunk?.lines.join('\n')}
            </div>
          )
        })}
      </div>

      {showSidebar && selectedChunk && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }} className='text-select'>
          {selectedChunk.displayLines.map((line, i) => (
            <div key={i} style={{ fontSize: '10px', wordBreak: 'break-word' }}>
              {line}
            </div>
          ))}
          <div style={{ marginTop: '10px', fontSize: '10px', whiteSpace: 'pre', maxWidth: 100, }}>
            <div>Sidebar Info:</div>
            {selectedChunk.sidebarLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
