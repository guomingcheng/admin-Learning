import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JSBI, Percent, Router, SwapParameters, Trade, TradeType } from 'binance-sdk1.0'
import { useMemo } from 'react'
import { BIPS_BASE, DEFAULT_DEADLINE_FROM_NOW, INITIAL_ALLOWED_SLIPPAGE } from '../constants'
import { getTradeVersion, useV1TradeExchangeAddress } from '../data/V1'
import { useTransactionAdder } from '../state/transactions/hooks'
import { calculateGasMargin, getRouterContract, isAddress, shortenAddress } from '../utils'
import isZero from '../utils/isZero'
import v1SwapArguments from '../utils/v1SwapArguments'
import { useActiveWeb3React } from './index'
import { useV1ExchangeContract } from './useContract'
import useENS from './useENS'
import { Version } from './useToggledVersion'

export enum SwapCallbackState {
  /**
   * 无效的交易
   * */
  INVALID,
  /**
   * 交易加载中
   * */
  LOADING,
  /** 
   * 有效的交易
   * */
  VALID
}

interface SwapCall {
  contract: Contract
  parameters: SwapParameters
}

interface SuccessfulCall {
  call: SwapCall
  gasEstimate: BigNumber
}

interface FailedCall {
  call: SwapCall
  error: Error
}

type EstimatedSwapCall = SuccessfulCall | FailedCall

/**
 * 解析交易对生成用于调用 router 合约的方法名和参数
 * @param trade 要执行的交易
 * @param allowedSlippage 用户允许的滑动
 * @param deadline 交易截止日期
 * @param recipientAddressOrName
 */
function useSwapCallArguments(
  trade: Trade | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  deadline: number = DEFAULT_DEADLINE_FROM_NOW, // in seconds from now
  recipientAddressOrName: string | null // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): SwapCall[] {

  //读取用户连接的状态
  const { account, chainId, library } = useActiveWeb3React()

  //获取接收者地址
  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress

  const v1Exchange = useV1ExchangeContract(useV1TradeExchangeAddress(trade), true)

  return useMemo(() => {
    // 校验对象包含的 pair 类是否是 v1 版本的对象
    const tradeVersion = getTradeVersion(trade)
    if (!trade || !recipient || !library || !account || !tradeVersion || !chainId) return []    // 这些核心参数必须要都是有效值

    // 创建链接路由合约的对象
    const contract: Contract | null =
      tradeVersion === Version.v2 ? getRouterContract(chainId, library, account) : v1Exchange
    if (!contract) {
      return []
    }

    // 遍历交易路径，将调用方法名称和参数存入数组
    const swapMethods = []

    // 区分 v1 与 v2
    switch (tradeVersion) {
      case Version.v2:
        swapMethods.push(
          // 返回调用路由合约的 methodName, args, value(eth)
          Router.swapCallParameters(trade, {
            feeOnTransfer: false,
            allowedSlippage: new Percent(JSBI.BigInt(allowedSlippage), BIPS_BASE),
            recipient,
            ttl: deadline
          })
        )

        if (trade.tradeType === TradeType.EXACT_INPUT) {
          swapMethods.push(
            Router.swapCallParameters(trade, {
              feeOnTransfer: true,
              allowedSlippage: new Percent(JSBI.BigInt(allowedSlippage), BIPS_BASE),
              recipient,
              ttl: deadline
            })
          )
        }
        break
      case Version.v1:
        swapMethods.push(
          v1SwapArguments(trade, {
            allowedSlippage: new Percent(JSBI.BigInt(allowedSlippage), BIPS_BASE),
            recipient,
            ttl: deadline
          })
        )
        break
    }
    return swapMethods.map(parameters => ({ parameters, contract }))
  }, [account, allowedSlippage, chainId, deadline, library, recipient, trade, v1Exchange])
}

//如果参数都有效，则返回将执行交换的函数
//并且用户已批准交易的滑移调整投入金额
export function useSwapCallback(
  trade: Trade | undefined, // 交易路径
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // 滑点
  deadline: number = DEFAULT_DEADLINE_FROM_NOW, // 交易的有效时间
  recipientAddressOrName: string | null // 交易接收方的ENS名称或地址，如果掉期应返还给发送方，则为空
): { state: SwapCallbackState; callback: null | (() => Promise<string>); error: string | null } {

  // 获取钱包中的状态信息
  const { account, chainId, library } = useActiveWeb3React()

  // 遍历交易路径，获得调用函数名，和相关参数组成的数组
  const swapCalls = useSwapCallArguments(trade, allowedSlippage, deadline, recipientAddressOrName)

  // 发送交易的钩子函数
  const addTransaction = useTransactionAdder()

  // 交易接收者
  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress

  // 返回交易的 状态，回调，报错
  return useMemo(() => {
    // 交易非法交易
    if (!trade || !library || !account || !chainId) {
      return { state: SwapCallbackState.INVALID, callback: null, error: 'Missing dependencies' }  // 无效的交易
    }
    if (!recipient) { // 地址没有值的话
      if (recipientAddressOrName !== null) {
        return { state: SwapCallbackState.INVALID, callback: null, error: 'Invalid recipient' }   // 无效的交易
      } else {
        return { state: SwapCallbackState.LOADING, callback: null, error: null }  // 交易加载中
      }
    }

    // 当前版本
    const tradeVersion = getTradeVersion(trade)

    return {
      // 交易状态，通过校验
      state: SwapCallbackState.VALID, 
      // 交易回调的方法
      callback: async function onSwap(): Promise<string> {    // Promise 是 js 中等待结果的一个函数

        // 针对每一笔交易依次进行执行，估算 gas , 并在实际交易发出前提前发现错误
        const estimatedCalls: EstimatedSwapCall[] = await Promise.all(
          swapCalls.map(call => {

            // 解构参数
            const {
              parameters: { methodName, args, value },
              contract
            } = call

            const options = !value || isZero(value) ? {} : { value }

            // 估算 gsm 费用子在一个步
            return contract.estimateGas[methodName](...args, options)
              // 成功
              .then(gasEstimate => {
                return {
                  call,
                  gasEstimate
                }
              })
              // 失败
              .catch(gasError => {
                console.debug('Gas estimate failed, trying eth_call to extract error', call)

                // 如果在上面估算 gsm 失败后，尝试在这一步使用静态来调用合约
                return contract.callStatic[methodName](...args, options)
                  .then(result => {
                    // 静态调用成功，抛出错误，建议重新调用
                    console.debug('Unexpected successful call after failed estimate gas', call, gasError, result)
                    return { call, error: new Error('Unexpected issue with estimating the gas. Please try again.') }
                  })
                  .catch(callError => {
                    // 静态调用失败，抛出失败类型 
                    console.debug('Call threw error', call, callError)
                    let errorMessage: string
                    switch (callError.reason) {
                      case 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT':
                      case 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT':
                        errorMessage =
                          'This transaction will not succeed either due to price movement or fee on transfer. Try increasing your slippage tolerance.'
                        break
                      default:
                        errorMessage = `The transaction cannot succeed due to error: ${callError.reason}. This is probably an issue with one of the tokens you are swapping.`
                    }
                    return { call, error: new Error(errorMessage) }
                  })
              })
          })
        )

        // a successful estimation is a bignumber gas estimate and the next call is also a bignumber gas estimate
        // 判断预执行是否成功
        // 如果预执行成功，gasEstimate 字段是存放来预估的 gas 值
        const successfulEstimation = estimatedCalls.find(       // find 一旦有一个元素返回成功，就不会执行后面的元素了
          // el 是当前的项
          // ix 是当前的下标
          // list 是当前遍历的数组
          (el, ix, list): el is SuccessfulCall =>
            'gasEstimate' in el && (ix === list.length - 1 || 'gasEstimate' in list[ix + 1])
        )

        // 若全部失败，者抛出最后一个错误
        if (!successfulEstimation) {
          const errorCalls = estimatedCalls.filter((call): call is FailedCall => 'error' in call)
          if (errorCalls.length > 0) throw errorCalls[errorCalls.length - 1].error
          throw new Error('Unexpected error. Please contact support: none of the calls threw an error')
        }

        // 解构
        const {
          call: {
            contract,
            parameters: { methodName, args, value }
          },
          gasEstimate
        } = successfulEstimation

        return contract[methodName](...args, {
          // gasLimit 设置为预估的 gas 费用上浮 10%
          gasLimit: calculateGasMargin(gasEstimate),
          ...(value && !isZero(value) ? { value, from: account } : { from: account })
        })  
          .then((response: any) => {
            // 回调这里表示发送交易成功
            const inputSymbol = trade.inputAmount.currency.symbol   // 输入的代币名称
            const outputSymbol = trade.outputAmount.currency.symbol // 输出的代币名称
            const inputAmount = trade.inputAmount.toSignificant(3)  // 输入的精确数量
            const outputAmount = trade.outputAmount.toSignificant(3)  // 输出的精确的数量

            // 拼接成交易的信息
            const base = `Swap ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`
            // 如果接收者的地址等于钱包地址，就返回 base 交易信息，
            const withRecipient =
              recipient === account
                ? base
                : `${base} to ${
                    recipientAddressOrName && isAddress(recipientAddressOrName)
                      ? shortenAddress(recipientAddressOrName)
                      : recipientAddressOrName
                  }`

            // 看用户使用 v2 版本不，不是要加一些信息
            const withVersion =
              tradeVersion === Version.v2 ? withRecipient : `${withRecipient} on ${(tradeVersion as any).toUpperCase()}`

            addTransaction(response, {
              summary: withVersion
            })
            return response.hash

          })
          .catch((error: any) => {
            // if the user rejected the tx, pass this along
            if (error?.code === 4001) {
              throw new Error('Transaction rejected.')
            } else {
              // otherwise, the error was unexpected and we need to convey that
              console.error(`Swap failed`, error, methodName, args, value)
              throw new Error(`Swap failed: ${error.message}`)
            }
          })
      },
      error: null
    }
  }, [trade, library, account, chainId, recipient, recipientAddressOrName, swapCalls, addTransaction])
}
