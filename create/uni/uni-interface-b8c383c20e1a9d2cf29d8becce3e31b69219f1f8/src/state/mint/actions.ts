import { createAction } from '@reduxjs/toolkit'

/**
 * 添加流动性时，用户选择的 Token 类型
 * */
export enum Field {
  /**
   * 输入的 Token
   * */
  CURRENCY_A = 'CURRENCY_A',
  /**
   * 输出的 Token
   * */
  CURRENCY_B = 'CURRENCY_B'
}

export const typeInput = createAction<{ field: Field; typedValue: string; noLiquidity: boolean }>('mint/typeInputMint')
export const resetMintState = createAction<void>('mint/resetMintState')
