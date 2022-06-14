import { ChainId, Token } from 'binance-sdk1.0'
import { Tags, TokenInfo, TokenList } from '@uniswap/token-lists'
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { AppState } from '../index'

// keyof Tage 这意思是，获取 Tage 对象索引的类型，等价于 string|number。如果对象的字段不是索引类型，就是获取变量命，而不是类型
// Tags[keyof Tags] 这整合起来的意思是，获取类型，等价于 { readonly name: string; readonly description: string; };
// 所以: type TagDetails = { readonly name: string; readonly description: string; };
type TagDetails = Tags[keyof Tags]
export interface TagInfo extends TagDetails {
  id: string
}

/**
 * 根据令牌信息创建的令牌实例。
 */
export class WrappedTokenInfo extends Token {
  /**
   * 这个 TokenInfo 对象，也是代币信息的包装对象
   * */
  public readonly tokenInfo: TokenInfo
  /**
   * 标签对象
   * */
  public readonly tags: TagInfo[]

  constructor(tokenInfo: TokenInfo, tags: TagInfo[]) {
    super(tokenInfo.chainId, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
    this.tokenInfo = tokenInfo
    this.tags = tags
  }
  /**
   * 代币的 logo 头像 url
   * */
  public get logoURI(): string | undefined {
    return this.tokenInfo.logoURI
  }
}

/**
 * Readonly<> 放型接受一个对象，为这一个对象的所有属性标记为 readonly
 * 这个类型就相等与 { readonly  [chainId in ChainId]: { readonly [tokenAddress: string]: WrappedTokenInfo }}
 * */
export type TokenAddressMap = Readonly<{ [chainId in ChainId]: Readonly<{ [tokenAddress: string]: WrappedTokenInfo }> }>

/**
 * 空结果，作为默认值很有用。
 */
const EMPTY_LIST: TokenAddressMap = {
  [ChainId.KOVAN]: {},
  [ChainId.RINKEBY]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.GÖRLI]: {},
  [ChainId.MAINNET]: {},
  [ChainId.BINANCETEST]: {}
}


// WeakMap 结构是与 Map 结构类似，也是键值对的集合，但是 WeakMap key 值只能是一个对象，不能是其他类型
const listCache: WeakMap<TokenList, TokenAddressMap> | null =
  typeof WeakMap !== 'undefined' ? new WeakMap<TokenList, TokenAddressMap>() : null

/**
 * 这个函数是将《白名单列表》添加到 TokenAddressMap 对象中，并返回这个对象
 * 将代币信息 TokenList 对象包装成 TokenAddressMap 对象，这个对象概括了每一条链，以及链上的代币地址对应的代币详细信息
 * */
export function listToTokenMap(list: TokenList): TokenAddressMap {
  const result = listCache?.get(list)
  if (result) return result

  // tokenMap 是 TokenAddressMap 类型的对象, tokenInfo 是当前遍历的代币信息的对象
  const map = list.tokens.reduce<TokenAddressMap>( (tokenMap, tokenInfo) => {

      const tags: TagInfo[] =
        tokenInfo.tags
          ?.map(tagId => {
            if (!list.tags?.[tagId]) return undefined
            return { ...list.tags[tagId], id: tagId }
          })
          ?.filter((x): x is TagInfo => Boolean(x)) ?? []

      // 创建代币信息的对象
      const token = new WrappedTokenInfo(tokenInfo, tags)

      // 如果当前的代币已经有了代币信息的对象，就不用添加了
      if (tokenMap[token.chainId][token.address] !== undefined) throw Error('Duplicate tokens.')

      // 这个是把久值解构，在用新值覆盖
      return {
        ...tokenMap,
        [token.chainId]: {
          ...tokenMap[token.chainId],
          [token.address]: token
        }
      }
    },
    { ...EMPTY_LIST }
  )
  // 把代币信息包装成 TokenAddressMap 对象后，添加到 Map 中
  listCache?.set(list, map)
  return map
}

/**
 * 这个函数是根据 url 从状态管理中取出这个 url 《白名单列表》添加到 TokenAddressMap 对象中
 * */
export function useTokenList(url: string | undefined): TokenAddressMap {
  const lists = useSelector<AppState, AppState['lists']['byUrl']>(state => state.lists.byUrl)
  return useMemo(() => {
    // 如果 url 是 unfefined，就返回空的 TokenAddressMap
    if (!url) return EMPTY_LIST
    // 读取这个 url, 代币白名单列表对象
    const current = lists[url]?.current
    // 如果 current 是 unfefined, 就返回空的 TokenAddressMap
    if (!current) return EMPTY_LIST 
    try {
      // 添加
      return listToTokenMap(current)
    } catch (error) {
      // 由于错误，无法显示令牌列表
      console.error('Could not show token list due to error', error)
      return EMPTY_LIST
    }
  }, [lists, url])
}

/**
 * 返回前端展现白名单列表的那个 URL
 * */
export function useSelectedListUrl(): string | undefined {
  return useSelector<AppState, AppState['lists']['selectedListUrl']>(state => state.lists.selectedListUrl)
}

/**
 * 返回一个 TokenAddressMap 对象
 * 这个对象包含了当前前端展现《白名单列表》的信息
 * */
export function useSelectedTokenList(): TokenAddressMap {
  return useTokenList(useSelectedListUrl())
}

/**
 * 这个返回一个类似 ListsState 对象，包含一个 url 《白名单列表》的信息
 * 这个《白名单列表》的信息，是当前在前端展现的
 * */
export function useSelectedListInfo(): { current: TokenList | null; pending: TokenList | null; loading: boolean } {
  const selectedUrl = useSelectedListUrl()
  const listsByUrl = useSelector<AppState, AppState['lists']['byUrl']>(state => state.lists.byUrl)
  const list = selectedUrl ? listsByUrl[selectedUrl] : undefined
  return {
    current: list?.current ?? null,
    pending: list?.pendingUpdate ?? null,
    loading: list?.loadingRequestId !== null
  }
}

/**
 * 返回所有下载的当前列表
 * */
export function useAllLists(): TokenList[] {
  const lists = useSelector<AppState, AppState['lists']['byUrl']>(state => state.lists.byUrl)

  return useMemo(
    () =>
      Object.keys(lists)
        .map(url => lists[url].current)
        .filter((l): l is TokenList => Boolean(l)),
    [lists]
  )
}
