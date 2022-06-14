import { createAction } from '@reduxjs/toolkit'

/**
 * 这里的类型是记录了用户使用什么方式移除流动性
 * 
 * */
export enum Field {
  /**
   * 采用百分比的移除
   * */
  LIQUIDITY_PERCENT = 'LIQUIDITY_PERCENT',
  /**
   * 采用精确数值移除
   * */
  LIQUIDITY = 'LIQUIDITY',
  /**
   * 采用上框数值移除
   * */
  CURRENCY_A = 'CURRENCY_A',
  /**
   * 采用xia'kuang
   * */
  CURRENCY_B = 'CURRENCY_B'
}

export const typeInput = createAction<{ field: Field; typedValue: string }>('burn/typeInputBurn')
