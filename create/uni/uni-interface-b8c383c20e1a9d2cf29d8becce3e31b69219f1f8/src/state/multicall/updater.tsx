import { Contract } from '@ethersproject/contracts'
import { useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useActiveWeb3React } from '../../hooks'
import { useMulticallContract } from '../../hooks/useContract'
import useDebounce from '../../hooks/useDebounce'
import chunkArray from '../../utils/chunkArray'
import { CancelledError, retry, RetryableError } from '../../utils/retry'
import { useBlockNumber } from '../application/hooks'
import { AppDispatch, AppState } from '../index'
import {
  Call,
  errorFetchingMulticallResults,
  fetchingMulticallResults,
  parseCallKey,
  updateMulticallResults
} from './actions'

// chunk calls so we do not exceed the gas limit
const CALL_CHUNK_SIZE = 500

/**
 * 发送请求
 * @param multicallContract multicall contract to fetch against
 * @param chunk chunk of calls to make
 * @param minBlockNumber minimum block number of the result set
 */
async function fetchChunk(
  multicallContract: Contract,
  chunk: Call[],
  minBlockNumber: number
): Promise<{ results: string[]; blockNumber: number }> {
  console.debug('Fetching chunk', multicallContract, chunk, minBlockNumber)
  let resultsBlockNumber, returnData
  try {
    // 将批量请求组装成 calls 打包发送给 multicall.aggregate() 方法
    ;[resultsBlockNumber, returnData] = await multicallContract.aggregate(chunk.map(obj => [obj.address, obj.callData]))
  } catch (error) {
    console.debug('Failed to fetch chunk inside retry', error)
    throw error
  }
  if (resultsBlockNumber.toNumber() < minBlockNumber) {
    // 如果返回的区块，小于规定的过期的区块高度，抛出请求过期错误
    console.debug(`Fetched results for old block number: ${resultsBlockNumber.toString()} vs. ${minBlockNumber}`)
    throw new RetryableError('Fetched for old block number')
  }
  return { results: returnData, blockNumber: resultsBlockNumber.toNumber() }
}

/**
 * 在每种相同的请求内，筛选出优先级最高的监听器。
 * 找出同一种（合约地址，方法名称，入参全部相同）的请求，blocksPerFetch 最小的监听器代表的是最新的请求
 * 
 * @param allListeners the all listeners state
 * @param chainId the current chain id
 */
export function activeListeningKeys(
  allListeners: AppState['multicall']['callListeners'],
  chainId?: number
): { [callKey: string]: number } {
  if (!allListeners || !chainId) return {}
  const listeners = allListeners[chainId]
  if (!listeners) return {}

  return Object.keys(listeners).reduce<{ [callKey: string]: number }>((memo, callKey) => {
    const keyListeners = listeners[callKey]

    memo[callKey] = Object.keys(keyListeners)     // 这一步是筛选 blocksPerFetch <= 0 的请求
      .filter(key => {
        const blocksPerFetch = parseInt(key)
        if (blocksPerFetch <= 0) return false
        return keyListeners[blocksPerFetch] > 0
      })
      .reduce((previousMin, current) => {
        return Math.min(previousMin, parseInt(current))
      }, Infinity)
    return memo
  }, {})
}

/**
 * 接收activeListeningKeys()返回的列表，继续筛选出数据过期，需要发送请求的监听器列表
 * @param callResults 返回的状态数据
 * @param listeningKeys each call key mapped to how old the data can be in blocks
 * @param chainId the current chain id
 * @param latestBlockNumber the latest block number
 */
export function outdatedListeningKeys(
  callResults: AppState['multicall']['callResults'],
  listeningKeys: { [callKey: string]: number },
  chainId: number | undefined,
  latestBlockNumber: number | undefined
): string[] {

  if (!chainId || !latestBlockNumber) return []
  const results = callResults[chainId]
  // 如果没有数据，说明还没有发送请求，直接返回需要请求的 call
  if (!results) return Object.keys(listeningKeys)

  return Object.keys(listeningKeys).filter(callKey => {
    // 获取当前请求的优先级
    const blocksPerFetch = listeningKeys[callKey]

    // 如果这条 call 数据为空，表示还没有请求过，需要请求
    const data = callResults[chainId][callKey]
    // no data, must fetch
    if (!data) return true

    const minDataBlockNumber = latestBlockNumber - (blocksPerFetch - 1)

    // 如果这条数据的区块大于 minDataBlockNumber，那么表示请求这条数据要么是请求中要么是请求成功了，所以就不需要重新请求
    if (data.fetchingBlockNumber && data.fetchingBlockNumber >= minDataBlockNumber) return false

    // 如果这条数据的区块小于 minDataBlockNumber，表示已经过期了，需要重新请求
    return !data.blockNumber || data.blockNumber < minDataBlockNumber
  })
}

export default function Updater(): null {

  const dispatch = useDispatch<AppDispatch>()
  const state = useSelector<AppState, AppState['multicall']>(state => state.multicall)
  // wait for listeners to settle before triggering updates
  // 对 state 的变化做防抖处理，延迟 100ms 后再触发更新，100ms 内如果有变化， 则重新计算
  const debouncedListeners = useDebounce(state.callListeners, 100)

  const latestBlockNumber = useBlockNumber()    // 最新区块
  const { chainId } = useActiveWeb3React()

  // multicall 合约对象
  const multicallContract = useMulticallContract()
  // 返回一个 react ref 对象，用于再 updater() 的生命周期外持久化的存储取消调用的方法，每一次调用 updater()
  // 都会返回同一个对象，即每次触发 useEffect 时，都会从 ref 中拿到上一轮请求取消的方法，然后执行取消操作

  // useEf() 和自建一个 {current:...} 对象的唯一区别是，useRef() 会每次渲染时返回的都是同一个 ref 对象
  const cancellations = useRef<{ blockNumber: number; cancellations: (() => void)[] }>()

  const listeningKeys: { [callKey: string]: number } = useMemo(() => {
    return activeListeningKeys(debouncedListeners, chainId)
  }, [debouncedListeners, chainId])

  const unserializedOutdatedCallKeys = useMemo(() => {
    return outdatedListeningKeys(state.callResults, listeningKeys, chainId, latestBlockNumber)
  }, [chainId, state.callResults, listeningKeys, latestBlockNumber])

  // 主要用于 useEffect() 的监听
  // 进行排序并使用 JSON 转换为字符串，避免监听器顺序不同但数据没有变化，确触发更新情况
  const serializedOutdatedCallKeys = useMemo(() => JSON.stringify(unserializedOutdatedCallKeys.sort()), [
    unserializedOutdatedCallKeys
  ])

  useEffect(() => {
    if (!latestBlockNumber || !chainId || !multicallContract) return

    const outdatedCallKeys: string[] = JSON.parse(serializedOutdatedCallKeys)
    if (outdatedCallKeys.length === 0) return
    const calls = outdatedCallKeys.map(key => parseCallKey(key))

    const chunkedCalls = chunkArray(calls, CALL_CHUNK_SIZE)

    // 先执行上一轮的 useEffect() 请求的取消方法
    if (cancellations.current?.blockNumber !== latestBlockNumber) {
      cancellations.current?.cancellations?.forEach(c => c())
    }

    // 触发 state 事件
    dispatch(
      fetchingMulticallResults({
        calls,
        chainId,
        fetchingBlockNumber: latestBlockNumber
      })
    )

    cancellations.current = {
      blockNumber: latestBlockNumber,
      cancellations: chunkedCalls.map((chunk, index) => {

        // 使用 retry 包裹批量请求，拿到撤销 retry 的方法与批量请的 promise
        const { cancel, promise } = retry(() => fetchChunk(multicallContract, chunk, latestBlockNumber), {
          n: Infinity,
          minWait: 2500,
          maxWait: 3500
        })

        // 发送请求
        promise
          .then(({ results: returnData, blockNumber: fetchBlockNumber }) => {

            // 一旦批量请求成功，清空撤销方法，更新调用的最新区块高度（用作于下一轮判断）
            cancellations.current = { cancellations: [], blockNumber: latestBlockNumber }

            // accumulates the length of all previous indices
            // 计算索引值，用于更新结果
            const firstCallKeyIndex = chunkedCalls.slice(0, index).reduce<number>((memo, curr) => memo + curr.length, 0)
            const lastCallKeyIndex = firstCallKeyIndex + returnData.length

            // 触发 statue 更新事件，依照索引值对应的每个更新 callkey 的最新请求数据，
            dispatch(
              updateMulticallResults({
                chainId,
                results: outdatedCallKeys
                  .slice(firstCallKeyIndex, lastCallKeyIndex)
                  .reduce<{ [callKey: string]: string | null }>((memo, callKey, i) => {
                    memo[callKey] = returnData[i] ?? null
                    return memo
                  }, {}),
                blockNumber: fetchBlockNumber
              })
            )
          })
          .catch((error: any) => {
            if (error instanceof CancelledError) {
              console.debug('Cancelled fetch for blockNumber', latestBlockNumber)
              return
            }
            console.error('Failed to fetch multicall chunk', chunk, chainId, error)
            dispatch(
              errorFetchingMulticallResults({
                calls: chunk,
                chainId,
                fetchingBlockNumber: latestBlockNumber
              })
            )
          })
        return cancel
      })
    }
  }, [chainId, multicallContract, dispatch, serializedOutdatedCallKeys, latestBlockNumber])

  return null
}
