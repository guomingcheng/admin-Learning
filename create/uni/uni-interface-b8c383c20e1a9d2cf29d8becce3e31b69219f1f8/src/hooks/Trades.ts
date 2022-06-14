import { Currency, CurrencyAmount, Pair, Token, Trade } from 'binance-sdk1.0'
import flatMap from 'lodash.flatmap'
import { useMemo } from 'react'

import { BASES_TO_CHECK_TRADES_AGAINST, CUSTOM_BASES } from '../constants'
import { PairState, usePairs } from '../data/Reserves'
import { wrappedCurrency } from '../utils/wrappedCurrency'

import { useActiveWeb3React } from './index'


function useAllCommonPairs(currencyA?: Currency, currencyB?: Currency): Pair[] {
  // 获取当前链的 ID
  const { chainId } = useActiveWeb3React()

  // 获取定义好的 Token 路由
  const bases: Token[] = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : []

  // 检测输入于输出的 Token 是否有效
  const [tokenA, tokenB] = chainId
    ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
    : [undefined, undefined]

  
  // 由 bases Token 路由的代币，俩俩的配对组成的交易列表
  const basePairs: [Token, Token][] = useMemo(
    () =>
      flatMap(bases, (base): [Token, Token][] => bases.map(otherBase => [base, otherBase])).filter(
        ([t0, t1]) => t0.address !== t1.address
      ),
    [bases]
  )

  /**
   * 所有可能的中转交易对中进行筛选
   * 
   * 筛选 1： 一个交易对的 TokenA 与 TokenB 不能是相同的对象，否则就排除掉
   * 筛选 2： 一个交易对的 TokenA 与 TokenB 不能是通过的代币合约地址，否则就排除掉
   * 筛选 3： 一个交易对的 TokenA 与 TokenB 如果限制了代币交换，当这个交易对不符合条件，就排除掉
   * */
  const allPairCombinations: [Token, Token][] = useMemo(
    () =>
      tokenA && tokenB
        ? [
            // 单个交易池子，返回俩个 token 组成的交易对
            [tokenA, tokenB],
            // tokenA 与定义了路由 token 组成配对
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // tokenB 与定义了路由 token 组成配对
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // 由 bases Token 路由的代币，俩俩的配对组成的交易列表
            ...basePairs
          ]
            // 去重，交易对俩个地址是有效的，而且交易对俩个 token 不能是相等的
            .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
            .filter(([t0, t1]) => t0.address !== t1.address)

            // 某些 token 只能通过特定的交易对交易，需要排除
            .filter(([tokenA, tokenB]) => {
              if (!chainId) return true     // 如果没有链接钱包
              // 根据链 ID, 获取在这个链定义了某个 token 只能通过特定的 token 才能交换的 []
              const customBases = CUSTOM_BASES[chainId]
              if (!customBases) return true
              // 获取 tokenA 与 tokenB 限制交易的 Token [] 列表
              const customBasesA: Token[] | undefined = customBases[tokenA.address]
              const customBasesB: Token[] | undefined = customBases[tokenB.address]
              // 如果俩个 token 都没有限制，那么这个交易对就不排除
              if (!customBasesA && !customBasesB) return true

              // 如果定义限制的对象由一个等于当前的 tokenA 与 tokenB 就把这个交易对排除掉
              if (customBasesA && !customBasesA.find(base => tokenB.equals(base))) return false
              if (customBasesB && !customBasesB.find(base => tokenA.equals(base))) return false

              return true
            })
        : [],
    [tokenA, tokenB, bases, basePairs, chainId]
  )


  const allPairs = usePairs(allPairCombinations)

  // 校验合法与去重
  return useMemo(
    () =>
      Object.values(
        allPairs
          // 交易池子需要存在
          .filter((result): result is [PairState.EXISTS, Pair] => Boolean(result[0] === PairState.EXISTS && result[1]))
          // 去重
          .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
            return memo
          }, {})
      ),
    [allPairs]
  )
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useTradeExactIn(currencyAmountIn?: CurrencyAmount, currencyOut?: Currency): Trade | null {
  const allowedPairs = useAllCommonPairs(currencyAmountIn?.currency, currencyOut)
  return useMemo(() => {
    if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
      return (
        Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, { maxHops: 3, maxNumResults: 1 })[0] ?? null
      )
    }
    return null
  }, [allowedPairs, currencyAmountIn, currencyOut])
}

/**
 * 根据用户输出得精确数量，计算出预计的输入数以及最佳的交易路径
 */
export function useTradeExactOut(currencyIn?: Currency, currencyAmountOut?: CurrencyAmount): Trade | null {

  const allowedPairs = useAllCommonPairs(currencyIn, currencyAmountOut?.currency)

  return useMemo(() => {
    if (currencyIn && currencyAmountOut && allowedPairs.length > 0) {
      return (
        Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, { maxHops: 3, maxNumResults: 1 })[0] ??
        null
      )
    }
    return null
  }, [allowedPairs, currencyIn, currencyAmountOut])
}
