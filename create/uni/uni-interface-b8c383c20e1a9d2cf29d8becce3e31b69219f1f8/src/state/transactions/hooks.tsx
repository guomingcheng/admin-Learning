import { TransactionResponse } from '@ethersproject/providers'
import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useActiveWeb3React } from '../../hooks'
import { AppDispatch, AppState } from '../index'
import { addTransaction } from './actions'
import { TransactionDetails } from './reducer'


/**
 * 添加一条用户的交易信息 
 */
export function useTransactionAdder(): (
  response: TransactionResponse,  // 可以获取ethers库事务响应并将其添加到事务列表的帮助器
  customData?: { summary?: string; approval?: { tokenAddress: string; spender: string } }
) => void {

  // chainId 链ID, account 用户地址
  const { chainId, account } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()

  return useCallback(
    (
      response: TransactionResponse,
      { summary, approval }: { summary?: string; approval?: { tokenAddress: string; spender: string } } = {}
    ) => {
      // 用户必须是链接了 Dapp
      if (!account) return
      if (!chainId) return

      // 解构 hash 值
      const { hash } = response
      if (!hash) {
        throw Error('No transaction hash found.')
      }
      dispatch(addTransaction({ hash, from: account, chainId, approval, summary }))
    },
    [dispatch, chainId, account]
  )
}

/**
 * 返回当前链，用户交易的所有记录 
 */
export function useAllTransactions(): { [txHash: string]: TransactionDetails } {
  const { chainId } = useActiveWeb3React()

  const state = useSelector<AppState, AppState['transactions']>(state => state.transactions)

  // 取出当前链的交易信息
  return chainId ? state[chainId] ?? {} : {}
}

/**
 * 这个函数用于判断 receipt 属性是否有值 
 */
export function useIsTransactionPending(transactionHash?: string): boolean {
  const transactions = useAllTransactions()

  // 确保这笔 transactionHash 交易哈希是有值的
  if (!transactionHash || !transactions[transactionHash]) return false

  // 判断 receipt 属性是否已经有值了，取反。
  return !transactions[transactionHash].receipt
}

/**
 * 返回事务是否在最后一天发生（86400秒*1000毫秒/秒）
 * 判断：tx 这笔交易是否已经过了一天时间，如果过了就返回 false
 * @param tx to check for recency
 */
export function isTransactionRecent(tx: TransactionDetails): boolean {
  return new Date().getTime() - tx.addedTime < 86_400_000
}

/**
 * 返回令牌是否有挂起的审批交易 
 */
export function useHasPendingApproval(tokenAddress: string | undefined, spender: string | undefined): boolean {
  const allTransactions = useAllTransactions()
  return useMemo(
    () =>
      typeof tokenAddress === 'string' &&
      typeof spender === 'string' &&
      // some 函数用于检测数组中的元素是否满足指定条件马，如果一个元素满足条件，则返回true,剩余的元素不会再检测。都没有满足就返回 false
      Object.keys(allTransactions).some(hash => {
        const tx = allTransactions[hash]
        if (!tx) return false
        if (tx.receipt) {
          return false
        } else {
          const approval = tx.approval
          if (!approval) return false
          return approval.spender === spender && approval.tokenAddress === tokenAddress && isTransactionRecent(tx)
        }
      }),
    [allTransactions, spender, tokenAddress]
  )
}
