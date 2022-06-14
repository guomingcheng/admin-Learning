import { InjectedConnector } from '@web3-react/injected-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { WalletLinkConnector } from '@web3-react/walletlink-connector'

const RPC_URLS = {
	1: 'https://mainnet.infura.io/v3/55d040fb60064deaa7acc8e320d99bd4',
	4: 'https://rinkeby.infura.io/v3/55d040fb60064deaa7acc8e320d99bd4',
	3: 'https://ropsten.infura.io/v3/55d040fb60064deaa7acc8e320d99bd4'
}

//注入式交互
//InjectedConnector 类配置的是与 matamask 交互，下面配置表示 dapp 只支持下面配置的主网 ID
export const injected = new InjectedConnector({
	supportedChainIds: [1, 3, 4, 5, 42, 97]
})


//远程式交互
//WalletConnectConnector 类配置的是与其他钱包交互，在前端唤起生成的二维码，手机钱包扫码建立
//链接，dapp 每一次操作的确认，都是由手机钱包来确定
export const walletconnect = new WalletConnectConnector({

	// 配置 dapp 支持建立链接的网络 ID, 如果用户当前网络 ID 不在内的话，是无法建立链接的
	rpc: {
		1: RPC_URLS[1],
		4: RPC_URLS[4],
		3: RPC_URLS[3]
	},
	qrcode: true,
	// 这个应该是配置二维码的格子
	pollingInterval: 15000
})

//这个远程式交互
//有些问题，需要每次唤起时都要清空，不然唤起不了
export function resetWalletConnector (connector) {
	if (connector && connector instanceof WalletConnectConnector) {
		connector.walletConnectProvider = undefined
	}
}

//这个远程交互自定义钱包软件
//这个也需要远程建立链接，但是区别于 WalletConnectConnector 地方在于，这个只能使用 coinbase
//钱包才能建立链接
//这个包是对 coinbase 的 walletlink sdk 进行了封装一层，这样很容易的配置 coinbase 钱包 
export const walletlink = new WalletLinkConnector({
	url: RPC_URLS[4],
	appName: 'demo-app',
	supportedChainIds: [1, 4]
})


