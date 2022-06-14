function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitRandom(min: number, max: number): Promise<void> {
  return wait(min + Math.round(Math.random() * Math.max(0, max - min)))
}

/**
 * This error is thrown if the function is cancelled before completing
 */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

/**
 * Throw this error if the function should retry
 */
export class RetryableError extends Error {}

/**
 * 当传入方法执行失败时，尝试重试，返回撤销执行的方法和执行的结果
 * 每次执行方法后，会在 minWait 和 maxWait 区间内随机出一个等待时间上限，超过则直接重试
 * @param fn 待执行的方法
 * @param n 最多执行多少次
 * @param minWait min wait between retries in ms
 * @param maxWait max wait between retries in ms
 */
export function retry<T>(
  fn: () => Promise<T>,
  { n, minWait, maxWait }: { n: number; minWait: number; maxWait: number }
): { promise: Promise<T>; cancel: () => void } {
  let completed = false
  let rejectCancelled: (error: Error) => void
  const promise = new Promise<T>(async (resolve, reject) => {
    rejectCancelled = reject
    while (true) {
      let result: T
      try {
        result = await fn()
        if (!completed) {
          resolve(result)
          completed = true
        }
        break
      } catch (error) {
        if (completed) {
          break
        }
        if (n <= 0 || !(error instanceof RetryableError)) {
          reject(error)
          completed = true
          break
        }
        n--
      }
      await waitRandom(minWait, maxWait)
    }
  })
  return {
    promise,
    cancel: () => {
      if (completed) return
      completed = true
      rejectCancelled(new CancelledError())
    }
  }
}
