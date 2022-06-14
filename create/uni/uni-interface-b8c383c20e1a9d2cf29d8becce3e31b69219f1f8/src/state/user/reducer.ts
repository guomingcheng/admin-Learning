import { INITIAL_ALLOWED_SLIPPAGE, DEFAULT_DEADLINE_FROM_NOW } from '../../constants'
import { createReducer } from '@reduxjs/toolkit'
import { updateVersion } from '../global/actions'
import {
  addSerializedPair,
  addSerializedToken,
  removeSerializedPair,
  removeSerializedToken,
  SerializedPair,
  SerializedToken,
  updateMatchesDarkMode,
  updateUserDarkMode,
  updateUserExpertMode,
  updateUserSlippageTolerance,
  updateUserDeadline
} from './actions'


/**
 * 获取当前时间戳 
 */
const currentTimestamp = () => new Date().getTime()


/**
 * 用户的状态 
 */
export interface UserState {
  
  /**
   * 上次 updateVersion 动作操作的时间戳 
   */
  lastUpdateVersionTimestamp?: number

  /**
   * 网页显示模式设置， 用户选择暗模式还是亮模式， true 为黑暗模式
   */
  userDarkMode: boolean | null 
  /**
   * 这个参数默认是为 true 的，应该是辅助 userDarkMode 参数
   */
  matchesDarkMode: boolean 

  /**
   * 专家模式设置
   */
  userExpertMode: boolean   

  /**
   *  用户设置滑点的值，1% 的滑点等于 100 数值, 0.5% 的滑点等于 50 数值
   **/
  userSlippageTolerance: number

  /**
   * 用户设置交易时间，如果如果一笔交易在设置的时间内没有交易完成，这笔交易就会失败, 1 等于 60
   */
  userDeadline: number

  /** 
   * 用户的 token 列表，这个对象包含了两个嵌套，第一层是链 ID, 第二层是 address ==> 代币基础的详细信息
   */
  tokens: {
    // 链 ID ==> 当前链的 token 代币列表
    [chainId: number]: {

      // SerializedToken 代币对象，属性包含了代币基础的元数据
      [address: string]: SerializedToken
    }
  }

  /**
   * 配对列表，也是包含了俩个嵌套，第一层是链 ID, 第二层是 俩个地址拼接地址 ==> 配对对象{ token0 token1}
   */
  pairs: {
    // 链 ID ==> 当前链 ID 的配对对象列表
    [chainId: number]: {
      // keyed by token0Address:token1Address
      [key: string]: SerializedPair
    }
  }

  /**
   * 时间戳 
   */
  timestamp: number
}

// 拼接字符串
function pairKey(token0Address: string, token1Address: string) {
  return `${token0Address};${token1Address}`
}

/**
 * 初始化 initialState UserState 对象 
 */
export const initialState: UserState = {
  userDarkMode: null,
  matchesDarkMode: false,
  userExpertMode: false,
  userSlippageTolerance: INITIAL_ALLOWED_SLIPPAGE,   // 设置用户的滑点是 0.5%
  userDeadline: DEFAULT_DEADLINE_FROM_NOW,           // 设置用户交易有效时间为 20 分钟，如果 20 分钟内交易没有完成就等于失败 
  tokens: {},
  pairs: {},
  timestamp: currentTimestamp()
}

export default createReducer(initialState, builder =>
  builder
    .addCase(updateVersion, state => {
      // slippage isnt being tracked in local storage, reset to default
      // noinspection SuspiciousTypeOfGuard
      if (typeof state.userSlippageTolerance !== 'number') {
        state.userSlippageTolerance = INITIAL_ALLOWED_SLIPPAGE
      }

      // deadline isnt being tracked in local storage, reset to default
      // noinspection SuspiciousTypeOfGuard
      if (typeof state.userDeadline !== 'number') {
        state.userDeadline = DEFAULT_DEADLINE_FROM_NOW
      }

      state.lastUpdateVersionTimestamp = currentTimestamp()
    })
    .addCase(updateUserDarkMode, (state, action) => {
      state.userDarkMode = action.payload.userDarkMode
      state.timestamp = currentTimestamp()
    })
    .addCase(updateMatchesDarkMode, (state, action) => {
      state.matchesDarkMode = action.payload.matchesDarkMode
      state.timestamp = currentTimestamp()
    })
    .addCase(updateUserExpertMode, (state, action) => {
      state.userExpertMode = action.payload.userExpertMode
      state.timestamp = currentTimestamp()
    })
    .addCase(updateUserSlippageTolerance, (state, action) => {
      state.userSlippageTolerance = action.payload.userSlippageTolerance
      state.timestamp = currentTimestamp()
    })
    .addCase(updateUserDeadline, (state, action) => {
      state.userDeadline = action.payload.userDeadline
      state.timestamp = currentTimestamp()
    })
    /**
     * 添加 token 代币到用户列表中 
     */
    .addCase(addSerializedToken, (state, { payload: { serializedToken } }) => {
      // 还没有值时，先初始 {} 空对象
      state.tokens[serializedToken.chainId] = state.tokens[serializedToken.chainId] || {}
      // 在这个列表为当前链添加一条代币 token 信息
      state.tokens[serializedToken.chainId][serializedToken.address] = serializedToken
      state.timestamp = currentTimestamp()
    })
    /**
     * 从用户列表中删除一条 token 代币信息
     */
    .addCase(removeSerializedToken, (state, { payload: { address, chainId } }) => {
      state.tokens[chainId] = state.tokens[chainId] || {}
      // 根据 链ID 代币地址，就可以从用户列表中删除
      delete state.tokens[chainId][address]
      state.timestamp = currentTimestamp()
    })
    .addCase(addSerializedPair, (state, { payload: { serializedPair } }) => {
      if (
        // 配对对象的俩个 token, 必须是属于同一个链的
        serializedPair.token0.chainId === serializedPair.token1.chainId &&
        // 地址不能相等
        serializedPair.token0.address !== serializedPair.token1.address
      ) {
        const chainId = serializedPair.token0.chainId
        state.pairs[chainId] = state.pairs[chainId] || {}
        // 添加配对对象
        state.pairs[chainId][pairKey(serializedPair.token0.address, serializedPair.token1.address)] = serializedPair
      }
      state.timestamp = currentTimestamp()
    })
    .addCase(removeSerializedPair, (state, { payload: { chainId, tokenAAddress, tokenBAddress } }) => {
      if (state.pairs[chainId]) {
        // 删除配对对象
        delete state.pairs[chainId][pairKey(tokenAAddress, tokenBAddress)]
        delete state.pairs[chainId][pairKey(tokenBAddress, tokenAAddress)]
      }
      state.timestamp = currentTimestamp()
    })
)
