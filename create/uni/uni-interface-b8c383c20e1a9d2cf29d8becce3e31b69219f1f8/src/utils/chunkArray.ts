/**
 * 将 items 数组转换为 [item], 也就是 T[][] 类型
 * */
export default function chunkArray<T>(items: T[], maxChunkSize: number): T[][] {
  if (maxChunkSize < 1) throw new Error('maxChunkSize must be gte 1')
  if (items.length <= maxChunkSize) return [items]

  const numChunks: number = Math.ceil(items.length / maxChunkSize)
  const chunkSize = Math.ceil(items.length / numChunks)

  return [...Array(numChunks).keys()].map(ix => items.slice(ix * chunkSize, ix * chunkSize + chunkSize))
}
