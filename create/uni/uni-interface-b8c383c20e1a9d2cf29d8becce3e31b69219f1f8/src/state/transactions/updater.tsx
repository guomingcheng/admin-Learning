import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useActiveWeb3React } from '../../hooks'
import { useAddPopup, useBlockNumber } from '../application/hooks'
import { AppDispatch, AppState } from '../index'
import { checkedTransaction, finalizeTransaction } from './actions'

export function shouldCheck(
  lastBlockNumber: number,
  tx: { addedTime: number; receipt?: {}; lastCheckedBlockNumber?: number }
): boolean {
  if (tx.receipt) return false  // 如果这个参数有值了，那么就表示这个一笔交易不需要轮询
  if (!tx.lastCheckedBlockNumber) return true // 如果这个没有值，那么表示这一笔交易需要轮询
  // 获取区间区块
  const blocksSinceCheck = lastBlockNumber - tx.lastCheckedBlockNumber  
  if (blocksSinceCheck < 1) return false    // 如果区块的间隔还没有大于 1，那么这笔交易先不要轮询
  // 获取这笔交易发送到现在的间隔事件，分钟为单位
  const minutesPending = (new Date().getTime() - tx.addedTime) / 1000 / 60
  if (minutesPending > 60) {  // 大于 60 分钟吗
    // 如果等待时间超过一小时，就表示这一笔交易 10 个区块在轮询一次
    return blocksSinceCheck > 9
  } else if (minutesPending > 5) {  // 大于 5 分钟吗
    // 如果等待时间超过5分钟，就表示这一笔交易 2 个区块再轮询一次
    return blocksSinceCheck > 2
  } else {
    // 如果小于5分钟，1 个区块轮询一次
    return true
  }
}

export default function Updater(): null {

  // 钱包链接的状态
  const { chainId, library } = useActiveWeb3React()

  // 最后更新的区块
  const lastBlockNumber = useBlockNumber()


  const dispatch = useDispatch<AppDispatch>()
  // 获取交易记录的状态
  const state = useSelector<AppState, AppState['transactions']>(state => state.transactions)
  // 当前链的
  const transactions = chainId ? state[chainId] ?? {} : {}

  // show popup on confirm
  const addPopup = useAddPopup()

  useEffect(() => {
    if (!chainId || !library || !lastBlockNumber) return      // 这个几个参数必须是有效的值

    Object.keys(transactions)
      .filter(hash => shouldCheck(lastBlockNumber, transactions[hash]))     // 筛选需要轮询的交易
      // 为每一次交易建立轮询
      .forEach(hash => {
        library
          .getTransactionReceipt(hash)    // 监听这笔交易的完成
          .then(receipt => {// 完成后回调
            if (receipt) {
              dispatch(
                // 交易完成调用 finalizeTransaction 动作更新最后
                finalizeTransaction({
                  chainId,
                  hash,
                  receipt: {
                    blockHash: receipt.blockHash,
                    blockNumber: receipt.blockNumber,
                    contractAddress: receipt.contractAddress,
                    from: receipt.from,
                    status: receipt.status,
                    to: receipt.to,
                    transactionHash: receipt.transactionHash,
                    transactionIndex: receipt.transactionIndex
                  }
                })
              )
              // 显示交易已确认的提示窗口
              addPopup(
                {
                  txn: {
                    hash,
                    success: receipt.status === 1,
                    summary: transactions[hash]?.summary
                  }
                },
                hash
              )
            } else {
              // 交易还没有结果，发送 checkedTransaction 事件继续监听
              dispatch(checkedTransaction({ chainId, hash, blockNumber: lastBlockNumber }))
            }
          })
          .catch(error => {
            console.error(`failed to check transaction hash: ${hash}`, error)
          })
      })
  }, [chainId, library, transactions, lastBlockNumber, dispatch, addPopup])

  return null
}
