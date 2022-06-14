import { createReducer } from '@reduxjs/toolkit'
import {
  addTransaction,
  checkedTransaction,
  clearAllTransactions,
  finalizeTransaction,
  SerializableTransactionReceipt
} from './actions'

const now = () => new Date().getTime()

/**
 * 用户与 swap 交互信息状态
 */
export interface TransactionDetails {
  
  /**
   * 交互的 hash 值，唯一的 */
  hash: string
  /**
   * 授权：这笔交易，记录用户把 tokenAddress 代币授权给 spender 路由合约 */
  approval?: { tokenAddress: string; spender: string }
  /**
   * 交互的字面信息 */
  summary?: string
  /**
   * 交互的详细信息 */
  receipt?: SerializableTransactionReceipt
  /**
   * 最后检查的区块 */
  lastCheckedBlockNumber?: number
  /**
   * 添加交易信息的时间戳 */
  addedTime: number
  /**
   * 交易完成的时间戳 */
  confirmedTime?: number
  /**
   * 用户地址 */
  from: string
}

/**
 * 每条链对应用户的交互信息 
 */
export interface TransactionState {
  [chainId: number]: {
    [txHash: string]: TransactionDetails
  }
}

export const initialState: TransactionState = {}

export default createReducer(initialState, builder =>
  builder
    .addCase(addTransaction, (transactions, { payload: { chainId, from, hash, approval, summary } }) => {

      // 交易添加的新交易是否已经存在
      // transactions[chainId]?.[hash] 获取这条交易哈希，是否以及有了交易信息
      if (transactions[chainId]?.[hash]) {
        throw Error('Attempted to add existing transaction.')
      }
      // 初始化，如果用户还没有交易记录，就赋值一个 {} 对象
      const txs = transactions[chainId] ?? {}
      txs[hash] = { hash, approval, summary, from, addedTime: now() }
      // 添加一条数据
      transactions[chainId] = txs
    })
    .addCase(clearAllTransactions, (transactions, { payload: { chainId } }) => {
      // 清空交易信息
      // 如果没有值，就之间返回即可
      if (!transactions[chainId]) return
      // 清空
      transactions[chainId] = {}
    })
    .addCase(checkedTransaction, (transactions, { payload: { chainId, hash, blockNumber } }) => {
      const tx = transactions[chainId]?.[hash]
      if (!tx) {
        return
      }
      if (!tx.lastCheckedBlockNumber) {
        // 如果没有值赋值这个区块
        tx.lastCheckedBlockNumber = blockNumber
      } else {
        // 取最大区块的值，作为最后检查区块
        tx.lastCheckedBlockNumber = Math.max(blockNumber, tx.lastCheckedBlockNumber)
      }
    })
    .addCase(finalizeTransaction, (transactions, { payload: { hash, chainId, receipt } }) => {
      // 交易确认事件
      const tx = transactions[chainId]?.[hash]
      if (!tx) {
        return
      }
      // 为记录添加交易返回的数据
      tx.receipt = receipt
      // 交易完成时间
      tx.confirmedTime = now()
    })
)
