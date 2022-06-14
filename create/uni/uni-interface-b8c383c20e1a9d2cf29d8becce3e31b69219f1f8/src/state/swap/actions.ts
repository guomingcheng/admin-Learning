import { createAction } from '@reduxjs/toolkit'

export enum Field {
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT'
}

/**
 * 选择 Token   
 */
export const selectCurrency = createAction<{ field: Field; currencyId: string }>('swap/selectCurrency')
/**
 * 上下类型转换 
 */
export const switchCurrencies = createAction<void>('swap/switchCurrencies')

/**
 * 输入值 
 */
export const typeInput = createAction<{ field: Field; typedValue: string }>('swap/typeInput')

/**
 * 替换 swapState 状态，直接指向一个新的  
 * */
export const replaceSwapState = createAction<{
  field: Field
  typedValue: string
  inputCurrencyId?: string
  outputCurrencyId?: string
  recipient: string | null
}>('swap/replaceSwapState')
export const setRecipient = createAction<{ recipient: string | null }>('swap/setRecipient')
