import { createReducer } from '@reduxjs/toolkit'
import { Field, resetMintState, typeInput } from './actions'

/**
 * 流动性的状态
 * */
export interface MintState {
  /**
   * 输入的类型
   * */
  readonly independentField: Field
  /**
   * 输入的值
   * */
  readonly typedValue: string
  /**
   * 如果是第一次添加流动性，这个另外要输入的值，
   * */
  readonly otherTypedValue: string // for the case when there's no liquidity
}

/**
 * 初始化对象
 * */
const initialState: MintState = {
  independentField: Field.CURRENCY_A,
  typedValue: '',
  otherTypedValue: ''
}

export default createReducer<MintState>(initialState, builder =>
  builder
    .addCase(resetMintState, () => initialState)  
    .addCase(typeInput, (state, { payload: { field, typedValue, noLiquidity } }) => {

      // noLidquidity 为 true 代表着是创建一个新的池子
      // 创建新的池子不需要自动计算另一边数量，不用清空另一个输入框的数值
      if (noLiquidity) {
        // 输入用户选择的是输入
        if (field === state.independentField) {
          return {
            ...state,
            independentField: field,
            typedValue
          }
        }
        // they're typing into a new field, store the other value
        else {
          return {
            ...state,
            independentField: field,
            typedValue,
            otherTypedValue: state.typedValue
          }
        }
      } else {
        // 这个交易对，如果已经有了流动性，那么另外一个输入框需要自动的计算，所以要清空
        return {
          ...state,
          independentField: field,
          typedValue,
          otherTypedValue: ''
        }
      }
    })
)
