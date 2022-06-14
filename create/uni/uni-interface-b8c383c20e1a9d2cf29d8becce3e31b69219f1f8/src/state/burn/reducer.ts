import { createReducer } from '@reduxjs/toolkit'
import { Field, typeInput } from './actions'

/**
 * 移除流动的状态
 * */
export interface BurnState {
  /**
   * 流动性移除的类型
   * */
  readonly independentField: Field
  /**
   * 数值
   * */
  readonly typedValue: string
}

/**
 * 默认百分比类型
 * */
const initialState: BurnState = {
  independentField: Field.LIQUIDITY_PERCENT,
  typedValue: '0'
}

export default createReducer<BurnState>(initialState, builder =>
  builder.addCase(typeInput, (state, { payload: { field, typedValue } }) => {
    return {
      ...state,
      independentField: field,
      typedValue
    }
  })
)
