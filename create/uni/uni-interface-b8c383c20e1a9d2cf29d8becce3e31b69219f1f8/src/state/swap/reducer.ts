import { createReducer } from '@reduxjs/toolkit'
import { Field, replaceSwapState, selectCurrency, setRecipient, switchCurrencies, typeInput } from './actions'

export interface SwapState {

  /**
   * 记录输入的类型，上框是输入，下框是输出 */
  readonly independentField: Field  //输入输出类型
  
  /**
   * 输入的 Token 数量 */
  readonly typedValue: string

  /**
   * 输入的地址 */
  readonly [Field.INPUT]: {
    readonly currencyId: string | undefined
  }

  /**
   * 输出的地址 */
  readonly [Field.OUTPUT]: {
    readonly currencyId: string | undefined
  }

  /**
   * 键入的收件人地址或ENS名称，如果swap应转到发件人，则为null */
  readonly recipient: string | null
}

const initialState: SwapState = {
  independentField: Field.INPUT,
  typedValue: '',
  [Field.INPUT]: {
    currencyId: ''
  },
  [Field.OUTPUT]: {
    currencyId: ''
  },
  recipient: null
}


export default createReducer<SwapState>(initialState, builder =>
  builder
    .addCase(
      replaceSwapState,
      (state, { payload: { typedValue, recipient, field, inputCurrencyId, outputCurrencyId } }) => {
        return {
          [Field.INPUT]: {
            currencyId: inputCurrencyId
          },
          [Field.OUTPUT]: {
            currencyId: outputCurrencyId
          },
          independentField: field,
          typedValue: typedValue,
          recipient
        }
      }
    )
    .addCase(selectCurrency, (state, { payload: { currencyId, field } }) => {
      // 类型取反
      const otherField = field === Field.INPUT ? Field.OUTPUT : Field.INPUT
      // 他这个处理是防止用户再一个输出类型有了 A Token, 再输入类型要选择 A Token, 这里就帮用户进行类转换

      // 如果取反后的 Field 类型 Token 等于用户选择的 Token, 就帮助用户上下转换
      if (currencyId === state[otherField].currencyId) {
        // the case where we have to swap the order
        return {
          ...state,
          // 这个类型也要转换
          independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
          // 用户选择的类型，就让这个 token 在这个类型
          [field]: { currencyId: currencyId },
          // 转
          [otherField]: { currencyId: state[field].currencyId }
        }
      } else {
        // 如果不等于的话，就直接为这个 File 类型赋值地址行
        return {
          ...state,
          [field]: { currencyId: currencyId }
        }
      }
    })
    .addCase(switchCurrencies, state => {
      return {
        ...state,
        // 类型取反
        independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
        // 把输出类型的 Toekn 赋值给输入
        [Field.INPUT]: { currencyId: state[Field.OUTPUT].currencyId },
        // 把输入类型的 Token 赋值给输出
        [Field.OUTPUT]: { currencyId: state[Field.INPUT].currencyId }
      }
    })
    .addCase(typeInput, (state, { payload: { field, typedValue } }) => {
      return {
        ...state,
        // 类型变更
        independentField: field,
        // 值
        typedValue
      }
    })
    .addCase(setRecipient, (state, { payload: { recipient } }) => {
      state.recipient = recipient
    })
)
