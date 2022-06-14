import { createReducer } from '@reduxjs/toolkit'
import {
  addMulticallListeners,
  errorFetchingMulticallResults,
  fetchingMulticallResults,
  removeMulticallListeners,
  toCallKey,
  updateMulticallResults
} from './actions'

export interface MulticallState {
  //调用侦听器
  callListeners?: {
    // 基于每条链
    [chainId: number]: {
      // 键为：{contractAddress}-{methodid}{calldata}
      [callKey: string]: {
        
        // 这里的 blockPerFetch 表示每个区块的意思，1 表示最新的以生成的区块，2 表示倒数第二区块，3 表示倒数第三个区块，依此类推
        // 值得意思：代表在这个区块上有多少次相同得调用，(合约地址、方法名、入参 三者一样)
        [blocksPerFetch: number]: number
      }
    }
  }

  //调用结果
  callResults: {
    // chainid
    [chainId: number]: {
      // `{contractAddress}-{methodid}{calldata}`
      [callKey: string]: {
        // 返回的数据
        data?: string | null
        // 区块的高度
        blockNumber?: number
        // 数据返回的最新区块
        fetchingBlockNumber?: number
      }
    }
  }
}

const initialState: MulticallState = {
  callResults: {}
}

export default createReducer(initialState, builder =>
  builder
    // 每当有新的请求，就会触发 add 事件，把这个请求添加到监听器中
    // blocksPerFetch 默认是 1 ，代表当前得区块
    .addCase(addMulticallListeners, (state, { payload: { calls, chainId, options: { blocksPerFetch = 1 } = {} } }) => {
      // 获取状态的 Call 监听器 callListeners 对象
      const listeners: MulticallState['callListeners'] = state.callListeners
        ? state.callListeners
        : (state.callListeners = {})

      // 保证初始化当前链的 Call
      listeners[chainId] = listeners[chainId] ?? {}
      calls.forEach(call => {
        // 每个请求的函数都与合约地址拼接起来，address-call 作为 key 值
        const callKey = toCallKey(call)
        // 保证初始 callKey 有效 {} 对象值
        listeners[chainId][callKey] = listeners[chainId][callKey] ?? {}
        
        // 这里主要是记录相同得调用得累加次数，作为后面判断是否优先重新请求得权重，每当有相同得请求，这里的值就会累加
        listeners[chainId][callKey][blocksPerFetch] = (listeners[chainId][callKey][blocksPerFetch] ?? 0) + 1
      })
    })
    // 移除请求的监听器(blockPerFetch - 1)
    // 一般作用于 useEffect() 的返回方法，每当组件从页面上消失时就会触发 useEffect()，就调用本地方法来清除消失的组件上的产生的监听器
    .addCase(
      removeMulticallListeners,
      (state, { payload: { chainId, calls, options: { blocksPerFetch = 1 } = {} } }) => {
        // 获取状态的 Call 监听器 callListeners 对象
        const listeners: MulticallState['callListeners'] = state.callListeners
          ? state.callListeners
          : (state.callListeners = {})

        // 如果是空对象就直接返回
        if (!listeners[chainId]) return
        calls.forEach(call => {
          // address-call 作为 key 值
          const callKey = toCallKey(call)
          if (!listeners[chainId][callKey]) return
          if (!listeners[chainId][callKey][blocksPerFetch]) return

          // 移除监听器实际是减少 blocksPerFetch 的值，即时减少其重新请求的优先级，当 blocksPerFetch 减到为 0 直接移除监听器
          if (listeners[chainId][callKey][blocksPerFetch] === 1) {
            delete listeners[chainId][callKey][blocksPerFetch]
          } else {
            // 这里就是减减
            listeners[chainId][callKey][blocksPerFetch]--
          }
        })
      }
    )
    // 更新事件，每当向链上发送请求时就会触发，更新请求时的最新区块 fetchingBlockNumber
    .addCase(fetchingMulticallResults, (state, { payload: { chainId, fetchingBlockNumber, calls } }) => {
      // 保证初始有效值，当前链的请求的值
      state.callResults[chainId] = state.callResults[chainId] ?? {}
      calls.forEach(call => {
        // address-call 作为 key 值
        const callKey = toCallKey(call)
        // current 是请求合约函数返回有效信息包装对象
        const current = state.callResults[chainId][callKey]
        if (!current) {
          state.callResults[chainId][callKey] = {
            fetchingBlockNumber
          }
        } else {
          if ((current.fetchingBlockNumber ?? 0) >= fetchingBlockNumber) return
          // 不大于就重新赋值
          state.callResults[chainId][callKey].fetchingBlockNumber = fetchingBlockNumber
        }
      })
    })
    // 请求返回出现错误的事件，把原本的旧数据清空
    .addCase(errorFetchingMulticallResults, (state, { payload: { fetchingBlockNumber, chainId, calls } }) => {
      // 保证初始有效值，当前链的请求的值
      state.callResults[chainId] = state.callResults[chainId] ?? {}
      calls.forEach(call => {
        const callKey = toCallKey(call)
        const current = state.callResults[chainId][callKey]
        if (!current) return // only should be dispatched if we are already fetching
        if (current.fetchingBlockNumber === fetchingBlockNumber) {
          delete current.fetchingBlockNumber
          current.data = null
          current.blockNumber = fetchingBlockNumber
        }
      })
    })
    // 请求成功时的事件，返回的数据写入 callResults
    .addCase(updateMulticallResults, (state, { payload: { chainId, results, blockNumber } }) => {
      state.callResults[chainId] = state.callResults[chainId] ?? {}
      Object.keys(results).forEach(callKey => {
        const current = state.callResults[chainId][callKey]
        if ((current?.blockNumber ?? 0) > blockNumber) return
        state.callResults[chainId][callKey] = {
          data: results[callKey],
          blockNumber
        }
      })
    })
)
