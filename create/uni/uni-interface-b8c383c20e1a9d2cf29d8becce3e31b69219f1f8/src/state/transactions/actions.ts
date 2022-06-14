import { createAction } from '@reduxjs/toolkit'
import { ChainId } from 'binance-sdk1.0'

/**
 * 一笔交易的详细信息
 */
export interface SerializableTransactionReceipt {
  /**
   * 合约的路由地址*/
  to: string
  /**
   * 这个地址就是用户自己的地址 */
  from: string
  /**
   * 合约地址，但是没有搞懂 */
  contractAddress: string
  /**
   * 交易的索引，不明白这是什么值 */
  transactionIndex: number
  /**
   * 区块哈希 */
  blockHash: string
  /** 
   * 交易哈希 */
  transactionHash: string
  /**
   * 交易完成的区块 */
  blockNumber: number
  /**
   * 交易的状态，1 代表成功，0 代表失败 */
  status?: number
}

/**
 * 添加一条交易记录 
 * */
export const addTransaction = createAction<{
  chainId: ChainId
  hash: string
  from: string
  approval?: { tokenAddress: string; spender: string }
  summary?: string
}>('transactions/addTransaction')

/**
 * 清空用户的所有交易记录
 * */
export const clearAllTransactions = createAction<{ chainId: ChainId }>('transactions/clearAllTransactions')

/**
 * 完成交易后，更新交易详情
 * */
export const finalizeTransaction = createAction<{
  chainId: ChainId
  hash: string
  receipt: SerializableTransactionReceipt
}>('transactions/finalizeTransaction')

/**
 * 这笔交易最后确认的区块
 * */
export const checkedTransaction = createAction<{
  chainId: ChainId
  hash: string
  blockNumber: number
}>('transactions/checkedTransaction')
