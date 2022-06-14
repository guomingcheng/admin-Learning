import { Web3ReactProvider } from '@web3-react/core'
import { Web3Provider } from '@ethersproject/providers'
import VanillaConnectionComponent from './VanillaConnectionComponent'
import Web3ReactConnectionComponent from './Web3ReactConnectionComponent'

//这一步是为了解决远程式交互的一个小问题
//这样问题是，用户使用手机钱包与 dapp 建立了交互，如果用户在这个交互阶段内刷新了网页，会让本地存储
//walletCounnet 数据等不到更新，虽然还能保持双方链接，但是已经无法进行正确的交互响应了

//这段代码的意思就是，但用户刷新网页时，在加载前把 walletCounnet 数据都清空，用户在想用手机钱包进
//行交互时，就只能唤起重连。
//这样就可以解决了用户的困惑，这也是一种的解决方案
window.onload = function() {
	localStorage.clear();
};


function App () {
	const getLibrary = (provider) => {
		const library = new Web3Provider(provider, 'any')
		library.pollingInterval = 15000
		return library
	}

	return (
		<Web3ReactProvider getLibrary={getLibrary}>
			<div className="flex space-x-3">
				<Web3ReactConnectionComponent />
				<VanillaConnectionComponent />
			</div>
		</Web3ReactProvider>
	)
}

export default App
