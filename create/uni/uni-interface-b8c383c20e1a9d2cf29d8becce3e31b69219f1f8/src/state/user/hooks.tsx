import { ChainId, Pair, Token } from 'binance-sdk1.0'
import flatMap from 'lodash.flatmap'
import { useCallback, useMemo } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { BASES_TO_TRACK_LIQUIDITY_FOR, PINNED_PAIRS } from '../../constants'

import { useActiveWeb3React } from '../../hooks'
import { useAllTokens } from '../../hooks/Tokens'
import { AppDispatch, AppState } from '../index'
import {
  addSerializedPair,
  addSerializedToken,
  removeSerializedToken,
  SerializedPair,
  SerializedToken,
  updateUserDarkMode,
  updateUserDeadline,
  updateUserExpertMode,
  updateUserSlippageTolerance
} from './actions'

/**
 * Token 类转换为 SerializedToken 对象， 这俩个类型都是包含了代币的属性
 * @param token Token 类，这个是包含了代币信息的包装类
 */
function serializeToken(token: Token): SerializedToken {
  return {
    chainId: token.chainId,
    address: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name
  }
}

/**
 * SerializedToken 对象转换 Token 类， 这俩个类型都是包含了代币的属性
 * @param serializedToken SerializedToken 对象，这个是包装了代币信息的包装对象
 */
function deserializeToken(serializedToken: SerializedToken): Token {
  return new Token(
    serializedToken.chainId,
    serializedToken.address,
    serializedToken.decimals,
    serializedToken.symbol,
    serializedToken.name
  )
}

/**
 * 返回皮肤的模式，true 为黑暗模式，false 是白天模式
 */
export function useIsDarkMode(): boolean {
  const { userDarkMode, matchesDarkMode } = useSelector<
    AppState,
    { userDarkMode: boolean | null; matchesDarkMode: boolean }
  >(
    ({ user: { matchesDarkMode, userDarkMode } }) => ({
      userDarkMode,
      matchesDarkMode
    }),
    shallowEqual
  )

  // 如果等于 null, 表示是黑暗模式，matchesDarkMode 辅助返回即可，如果不是就返回 userDarkMode
  return userDarkMode === null ? matchesDarkMode : userDarkMode
}

/**
 * user.userDarkMode 皮肤显示模式
 * 返回 user.userDarkMode 属性状态值，以及修改 user.userDarkMode 状态的函数
 */
export function useDarkModeManager(): [boolean, () => void] {
  // 状态修改函数
  const dispatch = useDispatch<AppDispatch>()
  // 取出当前用户设置的模式
  const darkMode = useIsDarkMode()

  // 使用 useCallbacck() 函数包装一下，使用 toggleSetDarkMode() 函数的子组件不会因为其他状态变化重新渲染当前组件
  const toggleSetDarkMode = useCallback(() => {
    dispatch(updateUserDarkMode({ userDarkMode: !darkMode }))

    // 检测状态信息，只有当 darkMode 状态发生了修改，就会渲染使用 toggleSetDarkMode() 函数的组件
  }, [darkMode, dispatch])

  // useState()
  return [darkMode, toggleSetDarkMode]
}

/**
 * 返回《专家模式》的状态变量
 */
export function useIsExpertMode(): boolean {
  return useSelector<AppState, AppState['user']['userExpertMode']>(state => state.user.userExpertMode)
}

/**
 * user 专家模式属性
 * 返回 user.userExpertMode 状态变量，以及修改 user.userExpertMode 状态变量的值
 */
export function useExpertModeManager(): [boolean, () => void] {
  const dispatch = useDispatch<AppDispatch>()
  const expertMode = useIsExpertMode()

  const toggleSetExpertMode = useCallback(() => {
    dispatch(updateUserExpertMode({ userExpertMode: !expertMode }))
  }, [expertMode, dispatch])

  // useState()
  return [expertMode, toggleSetExpertMode]
}

/**
 *  USER 滑点 useStatue

 *  返回 user.userSlippageTolerance 状态变量，以及修改 user.userSlippageTolerance(number) 状态变量的函数
 */
export function useUserSlippageTolerance(): [number, (slippage: number) => void] {
  const dispatch = useDispatch<AppDispatch>()
  // 取出滑点的状态变量
  const userSlippageTolerance = useSelector<AppState, AppState['user']['userSlippageTolerance']>(state => {
    return state.user.userSlippageTolerance
  })

  // setUserSlippageTolerance(number), 这里说明 useCallback() 包装的函数是可以传递参数的
  const setUserSlippageTolerance = useCallback((userSlippageTolerance: number) => {
    // 修改滑点的值
    dispatch(updateUserSlippageTolerance({ userSlippageTolerance }))
  }, [dispatch])

  // sueState()
  return [userSlippageTolerance, setUserSlippageTolerance]
}

/**
 * user 《时间内交易生效》 属性
 * 返回  user.userDeadline 状态变量，以及 setUserDeadline(number) 修改状态变量的函数
 */
export function useUserDeadline(): [number, (slippage: number) => void] {
  const dispatch = useDispatch<AppDispatch>()
  // 取出《时间内交易生效》的状态变量
  const userDeadline = useSelector<AppState, AppState['user']['userDeadline']>(state => {
    return state.user.userDeadline
  })

  // setUserDeadline(number)
  const setUserDeadline = useCallback(
    (userDeadline: number) => {
      // 修改 《时间内交易生效》的状态变量
      dispatch(updateUserDeadline({ userDeadline }))
    },
    [dispatch]
  )
  // useStatue()
  return [userDeadline, setUserDeadline]
}

/**
 * 针对 serializedToken 属性进行添加一条数据操作
 * 返回一个修改 serializedToken 状态的函数，根据参数 (token: Token) 代币信息向用户 token 列表添加
 */
export function useAddUserToken(): (token: Token) => void {
  const dispatch = useDispatch<AppDispatch>()
  return useCallback(
    (token: Token) => {
      dispatch(addSerializedToken({ serializedToken: serializeToken(token) }))
    },
    [dispatch]
  )
}


/**
 * 针对 serializedToken 属性进行删除一条数据操作
 * 返回一个修改 serializedToken 状态的函数，根据参数 (chainId: number, address: string) 来删除
 */
export function useRemoveUserAddedToken(): (chainId: number, address: string) => void {
  const dispatch = useDispatch<AppDispatch>()
  return useCallback(
    (chainId: number, address: string) => {
      dispatch(removeSerializedToken({ chainId, address }))
    },
    [dispatch]
  )
}


/**
 * 返回用户自定义的 token[] 列表
 */
export function useUserAddedTokens(): Token[] {
  // 读取用户链接 Dapp 的链 id
  const { chainId } = useActiveWeb3React()
  const serializedTokensMap = useSelector<AppState, AppState['user']['tokens']>(({ user: { tokens } }) => tokens)

  // 这里的写法相等于 const tokenAll = useMemo(() => { return []})
  // 上面定义，下面就 return totenAll()   这里就合成了一步
  return useMemo(() => {
    
    // 如果用户没有链接钱包，那么 chainId 就是 undefined, 返回 [] 就行
    if (!chainId) return []
    // 这一步 serializedTokensMap[chainId as ChainId] ?? {} 如果当前链有存储了用户列表，就返回用户列表，否则就返回 {}

    // Object.values(serializedTokensMap[chainId as ChainId] ?? {}) 这里结合起来就是，把 {string:SerializedToken} 对象
    // - 的所有 value 值取出存放到一个数组中返回，就变成了 SerializedToken [] 类型

    // 最后一步就是，把 SerializedToken [] 转换为 Token[] 返回
    return Object.values(serializedTokensMap[chainId as ChainId] ?? {}).map(deserializeToken)
  }, [serializedTokensMap, chainId])
}


/**
 * 将 pair 类 转换为 SerializedPair 对象
 */
function serializePair(pair: Pair): SerializedPair {
  return {
    token0: serializeToken(pair.token0),
    token1: serializeToken(pair.token1)
  }
}

/**
 * 针对 pairs 属性添加一条配对数据
 * 返回一个修改 pairs 状态的函数，根据参数 (pair: Pair) 配对属性，向 user 配对列表添加一条配对信息
 */
export function usePairAdder(): (pair: Pair) => void {
  const dispatch = useDispatch<AppDispatch>()

  return useCallback(
    (pair: Pair) => {
      dispatch(addSerializedPair({ serializedPair: serializePair(pair) }))
    },
    [dispatch]
  )
}

/**
 * 给定两个令牌，返回代表其流动性份额的流动性令牌
 * @param tokenA 两个代币之一
 * @param tokenB 另一个代币
 */
export function toV2LiquidityToken([tokenA, tokenB]: [Token, Token]): Token {
  return new Token(tokenA.chainId, Pair.getAddress(tokenA, tokenB), 18, 'UNI-V2', 'Uniswap V2')
}

/**
 * 追踪用户的 Pool 信息
 * 返回用户关心 token 的相关 pool 列表。( 流动性池子 )列表
 */
export function useTrackedTokenPairs(): [Token, Token][] {
  const { chainId } = useActiveWeb3React()

  // token 列表：{ address => Token}
  const tokens = useAllTokens()

  // 获取置顶的配对
  const pinnedPairs = useMemo(() => (chainId ? PINNED_PAIRS[chainId] ?? [] : []), [chainId])

  // 获取所有的配对
  // 根据定义的主流代币与列表的代币组成每不一样的流动性配对
  const generatedPairs: [Token, Token][] = useMemo(
    () =>
      chainId 
        // 遍历
        ? flatMap(Object.keys(tokens), tokenAddress => {
            const token = tokens[tokenAddress]  // 根据 tokenAddress 获取列表中的 Token
            // for each token on the current chain,
            return (
              // 定义的主流 Token, 用来组合流动性配对
              (BASES_TO_TRACK_LIQUIDITY_FOR[chainId] ?? [])
                // to construct pairs of the given token with each base
                .map(base => {
                  if (base.address === token.address) {   // 不能与自己组合
                    return null
                  } else {
                    return [base, token] // 主流 Token 为和列表中的 Token 组合配对
                  }
                })
                .filter((p): p is [Token, Token] => p !== null) // 筛选，每个配对必须有效值
            )
          })
        : [],
    [tokens, chainId]
  )

  // 从 userState 状态中获取用户自定义配对
  const savedSerializedPairs = useSelector<AppState, AppState['user']['pairs']>(({ user: { pairs } }) => pairs)

  // 获取自定义配对
  const userPairs: [Token, Token][] = useMemo(() => {
    if (!chainId || !savedSerializedPairs) return []  // 必须是有效值
    const forChain = savedSerializedPairs[chainId]  // 获取当前链的自定义配对
    if (!forChain) return []  // 必须是有效值

    // 将这个配对对象转换为 [Token, Token][]
    return Object.keys(forChain).map(pairId => {
      return [deserializeToken(forChain[pairId].token0), deserializeToken(forChain[pairId].token1)]
    })
  }, [savedSerializedPairs, chainId])

  // concat 是把多个相同类型的数组，拼接成一个数组
  // 拼接配对列表，基于 baseToken 的交易对，置顶的交易对，用户自定义的交易对
  const combinedList = useMemo(() => userPairs.concat(generatedPairs).concat(pinnedPairs), [
    generatedPairs,
    pinnedPairs,
    userPairs
  ])

  // 去重，返回用户要显示 Pool 的列表
  return useMemo(() => {
    // dedupes pairs of tokens in the combined list
    const keyed = combinedList.reduce<{ [key: string]: [Token, Token] }>((memo, [tokenA, tokenB]) => {
      // 判断 TokenA 是否小于 TokenB
      const sorted = tokenA.sortsBefore(tokenB)
      // 拼接配对的地址
      const key = sorted ? `${tokenA.address}:${tokenB.address}` : `${tokenB.address}:${tokenA.address}`
      if (memo[key]) return memo  // 去重效果
      // 添加
      memo[key] = sorted ? [tokenA, tokenB] : [tokenB, tokenA]
      return memo
    }, {})

    return Object.keys(keyed).map(key => keyed[key])
  }, [combinedList])
}
