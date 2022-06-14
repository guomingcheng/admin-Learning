import { ChainId, JSBI, Percent, Token, WETH } from 'binance-sdk1.0'
import { AbstractConnector } from '@web3-react/abstract-connector'

import { fortmatic, injected, portis, walletconnect, walletlink } from '../connectors'

export const ROUTER_ADDRESS = '0xab047bB848d19c58df3084c4Efb3Da5b5Af64DEb'

// a list of tokens by chain
type ChainTokenList = {
  readonly [chainId in ChainId]: Token[]
}

export const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin')
//export const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD//C')
export const COMP = new Token(ChainId.MAINNET, '0xc00e94Cb662C3520282E6f5717214004A7f26888', 18, 'COMP', 'Compound')
export const MKR = new Token(ChainId.MAINNET, '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, 'MKR', 'Maker')
export const AMPL = new Token(ChainId.MAINNET, '0xD46bA6D942050d489DBd938a2C909A5d5039A161', 9, 'AMPL', 'Ampleforth')

export const USDC = new Token(ChainId.BINANCETEST, '0xEAA18061aB912Ad31302E0De7234E0832D76D53B', 18, 'USDC', 'USDCToken')
export const USDT = new Token(ChainId.BINANCETEST, '0x47bC397ab1c11aa1aED0a7C117169bc2F58f88AD', 18, 'USDT', 'Tether USD')
export const CHE = new Token(ChainId.BINANCETEST, '0x8F711FAEFb6e1f1bf945430c6060a5659e658CC6', 18, 'CHE', 'CHEToken')

const WETH_ONLY: ChainTokenList = {
  [ChainId.MAINNET]: [WETH[ChainId.MAINNET]],
  [ChainId.ROPSTEN]: [WETH[ChainId.ROPSTEN]],
  [ChainId.RINKEBY]: [WETH[ChainId.RINKEBY]],
  [ChainId.GÖRLI]: [WETH[ChainId.GÖRLI]],
  [ChainId.KOVAN]: [WETH[ChainId.KOVAN]],
  [ChainId.BINANCETEST]: [WETH[ChainId.BINANCETEST]]

}

/**
 * 配置常用的 token 为路由，比如建立了俩个 LP token，che => usdt, usdt => GodboG ,这样 che 是交换不了 GodboG 的
 * ，所有需要把 usdt 配置为路由 token, che 才能交换 GodboG
 * */
export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  ...WETH_ONLY,
  //[ChainId.MAINNET]: [...WETH_ONLY[ChainId.MAINNET], DAI, USDC, COMP, MKR],
  [ChainId.BINANCETEST]: [...WETH_ONLY[ChainId.BINANCETEST], USDT, USDC, CHE]
}

/**
 * 这个函数是用来限制交换的额，下面的参数就是只有通过 USDT 与 WBNB 才能交换 CHE，如果有的 token 与 USDT 和 WBNB 建立 LP,
 * 那么也是可以交换 CHE 的
 **/
export const CUSTOM_BASES: { [chainId in ChainId]?: { [tokenAddress: string]: Token[] } } = {
  /*[ChainId.MAINNET]: {
    [AMPL.address]: [DAI, WETH[ChainId.MAINNET]]
  }*/
  /*[ChainId.BINANCETEST]: {
      [CHE.address]: [USDT, WETH[ChainId.BINANCETEST]]
  }*/
}

/**
 * 这个是用来添加流动性时首页显示 token, 在这里添加的 LP token 都会显示出来
 **/
export const SUGGESTED_BASES: ChainTokenList = {
  ...WETH_ONLY,
  [ChainId.BINANCETEST]: [...WETH_ONLY[ChainId.BINANCETEST], USDT, CHE]
}

/**
 * 这个参数也是配置每个链的 Pool 配对
 * 
 * 这里设置了 Token, 都会于用户自定义与白名单列表一起组成不同样的配对，可以让用户能显示自己
 * 添加的流动性
 * 
 * */
export const BASES_TO_TRACK_LIQUIDITY_FOR: ChainTokenList = {
  ...WETH_ONLY,
  [ChainId.BINANCETEST]: [...WETH_ONLY[ChainId.BINANCETEST], USDT, CHE]
}

/**
 * 这里定义的了每个链的置顶 Pool 配对。
 * 作为在于，用户打开流动性页面时，会根据这里定义的配对来加载，如果用户有为这些配对添加了流动性
 * 那么就会显示出来
 * */
export const PINNED_PAIRS: { readonly [chainId in ChainId]?: [Token, Token][] } = {
  [ChainId.BINANCETEST]: [
    /*[
      new Token(ChainId.BINANCETEST, '0x47bC397ab1c11aa1aED0a7C117169bc2F58f88AD', 18, 'USDT', 'USDTToken'),
      new Token(ChainId.BINANCETEST, WETH[ChainId.BINANCETEST].address, 18, 'WBNB', 'WBNB')
    ]*/
    [USDC, USDT]
   // [DAI, USDT]
  ]
}

export interface WalletInfo {
  connector?: AbstractConnector
  name: string
  iconName: string
  description: string
  href: string | null
  color: string
  primary?: true
  mobile?: true
  mobileOnly?: true
}

export const SUPPORTED_WALLETS: { [key: string]: WalletInfo } = {
  INJECTED: {
    connector: injected,
    name: 'Injected',
    iconName: 'arrow-right.svg',
    description: 'Injected web3 provider.',
    href: null,
    color: '#010101',
    primary: true
  },
  METAMASK: {
    connector: injected,
    name: 'MetaMask',
    iconName: 'metamask.png',
    description: 'Easy-to-use browser extension.',
    href: null,
    color: '#E8831D'
  },
  WALLET_CONNECT: {
    connector: walletconnect,
    name: 'WalletConnect',
    iconName: 'walletConnectIcon.svg',
    description: 'Connect to Trust Wallet, Rainbow Wallet and more...',
    href: null,
    color: '#4196FC',
    mobile: true
  },
  WALLET_LINK: {
    connector: walletlink,
    name: 'Coinbase Wallet',
    iconName: 'coinbaseWalletIcon.svg',
    description: 'Use Coinbase Wallet app on mobile device',
    href: null,
    color: '#315CF5'
  },
  COINBASE_LINK: {
    name: 'Open in Coinbase Wallet',
    iconName: 'coinbaseWalletIcon.svg',
    description: 'Open in Coinbase Wallet app.',
    href: 'https://go.cb-w.com/mtUDhEZPy1',
    color: '#315CF5',
    mobile: true,
    mobileOnly: true
  },
  FORTMATIC: {
    connector: fortmatic,
    name: 'Fortmatic',
    iconName: 'fortmaticIcon.png',
    description: 'Login using Fortmatic hosted wallet',
    href: null,
    color: '#6748FF',
    mobile: true
  },
  Portis: {
    connector: portis,
    name: 'Portis',
    iconName: 'portisIcon.png',
    description: 'Login using Portis hosted wallet',
    href: null,
    color: '#4A6C9B',
    mobile: true
  }
}

export const NetworkContextName = 'NETWORK'

// default allowed slippage, in bips
export const INITIAL_ALLOWED_SLIPPAGE = 50
// 20 minutes, denominated in seconds
export const DEFAULT_DEADLINE_FROM_NOW = 60 * 20

// one basis point
export const ONE_BIPS = new Percent(JSBI.BigInt(1), JSBI.BigInt(10000))
export const BIPS_BASE = JSBI.BigInt( 10000)
// used for warning states
export const ALLOWED_PRICE_IMPACT_LOW: Percent = new Percent(JSBI.BigInt(100), BIPS_BASE) // 1%
export const ALLOWED_PRICE_IMPACT_MEDIUM: Percent = new Percent(JSBI.BigInt(300), BIPS_BASE) // 3%
export const ALLOWED_PRICE_IMPACT_HIGH: Percent = new Percent(JSBI.BigInt(500), BIPS_BASE) // 5%
// if the price slippage exceeds this number, force the user to type 'confirm' to execute
export const PRICE_IMPACT_WITHOUT_FEE_CONFIRM_MIN: Percent = new Percent(JSBI.BigInt(1000), BIPS_BASE) // 10%
// for non expert mode disable swaps above this
export const BLOCKED_PRICE_IMPACT_NON_EXPERT: Percent = new Percent(JSBI.BigInt(1500), BIPS_BASE) // 15%

// used to ensure the user doesn't send so much ETH so they end up with <.01
export const MIN_ETH: JSBI = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(16)) // .01 ETH
export const BETTER_TRADE_LINK_THRESHOLD = new Percent(JSBI.BigInt(75), JSBI.BigInt(10000))
