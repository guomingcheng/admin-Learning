import { Currency, CurrencyAmount, ETHER, JSBI, Pair, Percent, Price, TokenAmount } from 'binance-sdk1.0'
import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { PairState, usePair } from '../../data/Reserves'
import { useTotalSupply } from '../../data/TotalSupply'

import { useActiveWeb3React } from '../../hooks'
import { wrappedCurrency, wrappedCurrencyAmount } from '../../utils/wrappedCurrency'
import { AppDispatch, AppState } from '../index'
import { tryParseAmount } from '../swap/hooks'
import { useCurrencyBalances } from '../wallet/hooks'
import { Field, typeInput } from './actions'

const ZERO = JSBI.BigInt(0)

/**
 * 返回流动性状态
 * */
export function useMintState(): AppState['mint'] {
  return useSelector<AppState, AppState['mint']>(state => state.mint)
}

export function useDerivedMintInfo(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined
): {
  dependentField: Field                                       // 自动计算另一测需要 Token 的精确数量
  currencies: { [field in Field]?: Currency }                 // 来个输入与输出的 Token 
  pair?: Pair | null                                          // 流动性池子的对象    
  pairState: PairState                                        // 池子的状态
  currencyBalances: { [field in Field]?: CurrencyAmount }     // 用户在来个 Token 上的余额
  parsedAmounts: { [field in Field]?: CurrencyAmount }        // 解析后的数量数值
  price?: Price                                               // 当前交易的价格
  noLiquidity?: boolean                                       // 池子流动性是否为 0
  liquidityMinted?: TokenAmount                               // 预计用户能得到流动性 Token 的数量
  poolTokenPercentage?: Percent                               // 预计本次添加的流动性在总流动性的占比例
  error?: string                                              // 报错信息
} {

  // 状态
  const { account, chainId } = useActiveWeb3React()

  // 流动性的状态信息
  const { independentField, typedValue, otherTypedValue } = useMintState()

  // 依赖用户的输入的类型，来计算另一个的精确数值。
  // 如果是输入，那么就要计算输出，dependentField 就是这一步
  const dependentField = independentField === Field.CURRENCY_A ? Field.CURRENCY_B : Field.CURRENCY_A

  // 类型包装
  const currencies: { [field in Field]?: Currency } = useMemo(
    () => ({
      [Field.CURRENCY_A]: currencyA ?? undefined,
      [Field.CURRENCY_B]: currencyB ?? undefined
    }),
    [currencyA, currencyB]
  )

  // pair
  // 调用 @uniswap/sdk/pair 来获取池子的对象。
  const [pairState, pair] = usePair(currencies[Field.CURRENCY_A], currencies[Field.CURRENCY_B])
  // 查询这个流动性池子, 已经铸造了 LP Token 的总量
  const totalSupply = useTotalSupply(pair?.liquidityToken)

  // 池子流动性是否为 0， 或者是这个池子不存在
  const noLiquidity: boolean =
    pairState === PairState.NOT_EXISTS || Boolean(totalSupply && JSBI.equal(totalSupply.raw, ZERO))

  // 查询 account 持有这个俩个 Token 的余额
  const balances = useCurrencyBalances(account ?? undefined, [
    currencies[Field.CURRENCY_A],
    currencies[Field.CURRENCY_B]
  ])
  // 包装
  const currencyBalances: { [field in Field]?: CurrencyAmount } = {
    [Field.CURRENCY_A]: balances[0],
    [Field.CURRENCY_B]: balances[1]
  }

  // 用户键入的数量，转换为以太坊的单位
  const independentAmount: CurrencyAmount | undefined = tryParseAmount(typedValue, currencies[independentField])
  // 自动计算另一侧的数量
  const dependentAmount: CurrencyAmount | undefined = useMemo(() => {
    // 如果为 true, 就表示第一次添加流动性
    if (noLiquidity) {
      // 当前池子不存在或者流动性为 0， 不需要自动计算，由用户手动输入
      if (otherTypedValue && currencies[dependentField]) {
        return tryParseAmount(otherTypedValue, currencies[dependentField])
      }
      return undefined

      // 如果用户输入的是一个有效的值，那么就求另一侧的精确数量
    } else if (independentAmount) {
      // we wrap the currencies just to get the price in terms of the other token
      // 这里会用到 @uniswap/v2-sdk/TokenAmount 类型来包装输入数值
      const wrappedIndependentAmount = wrappedCurrencyAmount(independentAmount, chainId)
      // 校验这俩个 Token ，也是代币合约地址
      const [tokenA, tokenB] = [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]

      // 这些参数必须是有效值
      if (tokenA && tokenB && wrappedIndependentAmount && pair) {

        // 判断需要计算的是 TokenA 还是 TokenB
        const dependentCurrency = dependentField === Field.CURRENCY_B ? currencyB : currencyA

        // 调用 sdk 计算数值
        // pair 是 @uniswap/v2-sdk/Pair 类型
        const dependentTokenAmount =
          dependentField === Field.CURRENCY_B
            ? pair.priceOf(tokenA).quote(wrappedIndependentAmount)
            : pair.priceOf(tokenB).quote(wrappedIndependentAmount)


        return dependentCurrency === ETHER ? CurrencyAmount.ether(dependentTokenAmount.raw) : dependentTokenAmount
      }
      return undefined
    } else {
      return undefined
    }
  }, [noLiquidity, otherTypedValue, currencies, dependentField, independentAmount, currencyA, chainId, currencyB, pair])

  // 包装这俩个精确的值
  const parsedAmounts: { [field in Field]: CurrencyAmount | undefined } = {
    [Field.CURRENCY_A]: independentField === Field.CURRENCY_A ? independentAmount : dependentAmount,
    [Field.CURRENCY_B]: independentField === Field.CURRENCY_A ? dependentAmount : independentAmount
  }

  // 计算当前池子的价格
  const price = useMemo(() => {

    // 没有流动性按照用户输入的比例作为价格
    if (noLiquidity) {
      const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts
      if (currencyAAmount && currencyBAmount) {
        return new Price(currencyAAmount.currency, currencyBAmount.currency, currencyAAmount.raw, currencyBAmount.raw)
      }
      return undefined
    } else {
      // 已经有了流动性就调用 sdk 来计算
      const wrappedCurrencyA = wrappedCurrency(currencyA, chainId)
      return pair && wrappedCurrencyA ? pair.priceOf(wrappedCurrencyA) : undefined
    }
  }, [chainId, currencyA, noLiquidity, pair, parsedAmounts])

  // 预估用户可以得到的流动性 LP 代币
  const liquidityMinted = useMemo(() => {
    const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts
    const [tokenAmountA, tokenAmountB] = [
      wrappedCurrencyAmount(currencyAAmount, chainId),
      wrappedCurrencyAmount(currencyBAmount, chainId)
    ]
    if (pair && totalSupply && tokenAmountA && tokenAmountB) {
      // @uniswap/v2-sdk/Pair.getLiquidityMinted()
      // 本地计算用户预计能够得到的流动性数量
      // 将俩种 token 数量分别带入计算公式，取最小值
      // tokenAmountA / tokenAmountB * totalSupply
      // 如果是新的池子计算方式则是：tokenAmountA * tokenAmountB - MINIMUM_LIQUIDITY
      return pair.getLiquidityMinted(totalSupply, tokenAmountA, tokenAmountB)
    } else {
      return undefined
    }
  }, [parsedAmounts, chainId, pair, totalSupply])

  // 预估本地添加占比池子总流动性的百分比
  const poolTokenPercentage = useMemo(() => {
    if (liquidityMinted && totalSupply) {
      return new Percent(liquidityMinted.raw, totalSupply.add(liquidityMinted).raw)
    } else {
      return undefined
    }
  }, [liquidityMinted, totalSupply])

  let error: string | undefined
  if (!account) {
    error = 'Connect Wallet'
  }

  if (pairState === PairState.INVALID) {
    error = error ?? 'Invalid pair'
  }

  if (!parsedAmounts[Field.CURRENCY_A] || !parsedAmounts[Field.CURRENCY_B]) {
    error = error ?? 'Enter an amount'
  }

  const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts

  if (currencyAAmount && currencyBalances?.[Field.CURRENCY_A]?.lessThan(currencyAAmount)) {
    error = 'Insufficient ' + currencies[Field.CURRENCY_A]?.symbol + ' balance'
  }

  if (currencyBAmount && currencyBalances?.[Field.CURRENCY_B]?.lessThan(currencyBAmount)) {
    error = 'Insufficient ' + currencies[Field.CURRENCY_B]?.symbol + ' balance'
  }

  return {
    dependentField,
    currencies,
    pair,
    pairState,
    currencyBalances,
    parsedAmounts,
    price,
    noLiquidity,
    liquidityMinted,
    poolTokenPercentage,
    error
  }
}

export function useMintActionHandlers(
  noLiquidity: boolean | undefined
): {
  onFieldAInput: (typedValue: string) => void
  onFieldBInput: (typedValue: string) => void
} {
  const dispatch = useDispatch<AppDispatch>()

  const onFieldAInput = useCallback(
    (typedValue: string) => {
      dispatch(typeInput({ field: Field.CURRENCY_A, typedValue, noLiquidity: noLiquidity === true }))
    },
    [dispatch, noLiquidity]
  )
  const onFieldBInput = useCallback(
    (typedValue: string) => {
      dispatch(typeInput({ field: Field.CURRENCY_B, typedValue, noLiquidity: noLiquidity === true }))
    },
    [dispatch, noLiquidity]
  )

  return {
    onFieldAInput,
    onFieldBInput
  }
}
