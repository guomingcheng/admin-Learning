import { createReducer } from '@reduxjs/toolkit'
import { getVersionUpgrade, VersionUpgrade } from '@uniswap/token-lists'
import { TokenList } from '@uniswap/token-lists/dist/types'
import { DEFAULT_LIST_OF_LISTS, DEFAULT_TOKEN_LIST_URL } from '../../constants/lists'
import { updateVersion } from '../global/actions'
import { acceptListUpdate, addList, fetchTokenList, removeList, selectList } from './actions'
import UNISWAP_DEFAULT_LIST from '@uniswap/default-token-list'


/**
 * 白名单列表状态 
 */
export interface ListsState {
  readonly byUrl: {
    readonly [url: string]: {

      /**
       * 白名单列表对象
       * */
      readonly current: TokenList | null
      readonly pendingUpdate: TokenList | null
      /**
       * 请求 ID, 这个不太请求是干嘛的
       * */
      readonly loadingRequestId: string | null
      readonly error: string | null
    }
  }
  /**
   * 存储白名单 URL 列表的数组，在 lsit.ts 文件定义 DEFAULT_LIST_OF_LISTS 字段的 URL 数组列表
   * */
  readonly lastInitializedDefaultListOfLists?: string[]
  /**
   * 这个用于设置展现那个白名单列表，值就是白名单的 URL 
   * */
  readonly selectedListUrl: string | undefined
}

/**
 * 
 * */
const NEW_LIST_STATE: ListsState['byUrl'][string] = {
  error: null,
  current: null,
  loadingRequestId: null,
  pendingUpdate: null
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U> ? U[] : T[P] }

/**
 * 初始化 ListsState 对象类型的值
 * */
const initialState: ListsState = {
  
  lastInitializedDefaultListOfLists: DEFAULT_LIST_OF_LISTS,
  byUrl: {
    // 这一步是把白名单 URL 数组，变成 { URL => NEW_LIST_STATE ，URL => NEW_LIST_STATE } 这样，数组中多个值，这个对象也就有多少个
    // ... 这一步就是把上面的对象进行解构，byUrl 就初始化好了
    ...DEFAULT_LIST_OF_LISTS.reduce<Mutable<ListsState['byUrl']>>((memo, listUrl) => {
      memo[listUrl] = NEW_LIST_STATE
      return memo
    }, {}),
    [DEFAULT_TOKEN_LIST_URL]: {
      error: null,
      current: UNISWAP_DEFAULT_LIST,
      loadingRequestId: null,
      pendingUpdate: null
    }
  },
  selectedListUrl: undefined
}

export default createReducer(initialState, builder =>
  builder
    .addCase(fetchTokenList.pending, (state, { payload: { requestId, url } }) => {
      state.byUrl[url] = {
        // 解构
        ...state.byUrl[url],
        current: null,
        pendingUpdate: null,
        // 更新请求 ID
        loadingRequestId: requestId,
        error: null
      }
    })
    .addCase(fetchTokenList.fulfilled, (state, { payload: { requestId, tokenList, url } }) => {
      const current = state.byUrl[url]?.current
      const loadingRequestId = state.byUrl[url]?.loadingRequestId
      // 我猜测这一步是切换白名单列表
      // 才需要这一步，但是我无法银子
      if (current) {
        const upgradeType = getVersionUpgrade(current.version, tokenList.version)
        if (upgradeType === VersionUpgrade.NONE) return
        if (loadingRequestId === null || loadingRequestId === requestId) {
          state.byUrl[url] = {
            ...state.byUrl[url],
            loadingRequestId: null,
            error: null,
            current: current,
            pendingUpdate: tokenList
          }
        }
      } else {

        // 设置白名单 JSON 数据代币列表
        state.byUrl[url] = {
          ...state.byUrl[url],
          loadingRequestId: null,
          error: null,
          current: tokenList,
          pendingUpdate: null
        }
      }
    })
    .addCase(fetchTokenList.rejected, (state, { payload: { url, requestId, errorMessage } }) => {
      if (state.byUrl[url]?.loadingRequestId !== requestId) {
        // 无操作，因为这不是最新的请求
        return
      }

      state.byUrl[url] = {
        ...state.byUrl[url],
        loadingRequestId: null,
        error: errorMessage,  // 错误
        current: null,
        pendingUpdate: null
      }
    })
    .addCase(selectList, (state, { payload: url }) => {
      // 设置列表
      state.selectedListUrl = url
      // 如果这个 URL 没有 Token 相关的数据，就先为这个初始化一个空的对象
      if (!state.byUrl[url]) {
        state.byUrl[url] = NEW_LIST_STATE
      }
    })
    .addCase(addList, (state, { payload: url }) => {
      // 为这个 url 列表初始化一个空的对象
      if (!state.byUrl[url]) {
        state.byUrl[url] = NEW_LIST_STATE
      }
    })
    .addCase(removeList, (state, { payload: url }) => {
      // 有值就删除
      if (state.byUrl[url]) {
        delete state.byUrl[url]
      }
      // 如果删除的白名单列表，刚好是显示的列表
      if (state.selectedListUrl === url) {
        // 那么就默认指定 state.buUrl 第一个白名单列表展现
        state.selectedListUrl = Object.keys(state.byUrl)[0]
      }
    })
    .addCase(acceptListUpdate, (state, { payload: url }) => {
      if (!state.byUrl[url]?.pendingUpdate) {
        throw new Error('accept list update called without pending update')
      }

      // 更新列表，这个不知道怎么使用
      state.byUrl[url] = {
        ...state.byUrl[url],
        pendingUpdate: null,
        current: state.byUrl[url].pendingUpdate
      }
    })
    .addCase(updateVersion, state => {
      // state loaded from localStorage, but new lists have never been initialized
      if (!state.lastInitializedDefaultListOfLists) {
        state.byUrl = initialState.byUrl
        state.selectedListUrl = undefined
      } else if (state.lastInitializedDefaultListOfLists) {

        const lastInitializedSet = state.lastInitializedDefaultListOfLists.reduce<Set<string>>(
          (s, l) => s.add(l),
          new Set()
        )
        const newListOfListsSet = DEFAULT_LIST_OF_LISTS.reduce<Set<string>>((s, l) => s.add(l), new Set())

        DEFAULT_LIST_OF_LISTS.forEach(listUrl => {
          // set.has() 是用于判断 listUrl 是否在集合中，在返回 true, 否则返回 false
          // 这里就是用了取反
          if (!lastInitializedSet.has(listUrl)) {
            state.byUrl[listUrl] = NEW_LIST_STATE
          }
        })

        state.lastInitializedDefaultListOfLists.forEach(listUrl => {
          if (!newListOfListsSet.has(listUrl)) {
            delete state.byUrl[listUrl]
          }
        })
      }

      state.lastInitializedDefaultListOfLists = DEFAULT_LIST_OF_LISTS
    })
)

