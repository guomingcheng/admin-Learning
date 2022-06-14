// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (finance/PaymentSplitter.sol)

pragma solidity ^0.8.0;

import "../token/ERC20/utils/SafeERC20.sol";
import "../utils/Address.sol";
import "../utils/Context.sol";

/**
 * @title token 释放合约
 * @dev 该合约允许多个账户根据股份分享代币的释放。
 *
 * 这不是线性释放代币的合约，这个合约并不维护线性释放的模块，只是负责 account 提取释放的代币，account 每次提取都会把合约中所
 * 占比的股份，全部提走

 * 创建一个新的合约，这个合约负责线性释放的功能，按照区块或者时间
 *
 * `PaymentSplitter` follows a _pull payment_ model. This means that payments are not automatically forwarded to the
 * accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
 * function.
 *
 * NOTE: This contract assumes that ERC20 tokens will behave similarly to native tokens (Ether). Rebasing tokens, and
 * tokens that apply fees during transfers, are likely to not be supported as expected. If in doubt, we encourage you
 * to run tests before sending real value to this contract.
 */
contract PaymentSplitter is Context {


    event PayeeAdded(address account, uint256 shares);
    // 主币释放，提取释放额度
    event PaymentReleased(address to, uint256 amount);
    // erc20 代币释放，提取释放额度
    event ERC20PaymentReleased(IERC20 indexed token, address to, uint256 amount);
    event PaymentReceived(address from, uint256 amount);

    // 全部股份
    uint256 private _totalShares;
    // 已经释放的代币额度
    uint256 private _totalReleased;

    // 一个授款地址对应的是持有的股份
    mapping(address => uint256) private _shares;
    // 一个授款地址对应的是已经释放的额度
    mapping(address => uint256) private _released;

    // 授款人
    address[] private _payees;

    // erc20合约对应的是已经释放的代币额度
    mapping(IERC20 => uint256) private _erc20TotalReleased;
    // erc20合约对应的是，每个地址已经释放的额度
    mapping(IERC20 => mapping(address => uint256)) private _erc20Released;

    /**
     * @dev 定义收款账户
     *
     * [] payees:   一组收款的账户地址
     * [] shares:   每个地址持有分享释放代币的股份，下标相等为对应
     */
    constructor(address[] memory payees, uint256[] memory shares_) payable {
        // 俩个的长度必须是相等的
        require(payees.length == shares_.length, "PaymentSplitter: payees and shares length mismatch");
        // 释放合约，必须要有一个收款账户
        require(payees.length > 0, "PaymentSplitter: no payees");

        for (uint256 i = 0; i < payees.length; i++) {
            // 存储信息
            _addPayee(payees[i], shares_[i]);
        }
    }

    /**
     * @dev The Ether received will be logged with {PaymentReceived} events. Note that these events are not fully
     * reliable: it's possible for a contract to receive Ether without triggering this function. This only affects the
     * reliability of the events, and not the actual splitting of Ether.
     *
     * To learn more about this see the Solidity documentation for
     * https://solidity.readthedocs.io/en/latest/contracts.html#fallback-function[fallback
     * functions].
     */
    receive() external payable virtual {
        emit PaymentReceived(_msgSender(), msg.value);
    }

    /**
     * @dev 获取全部股份
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev 获取主币释放的额度
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
    }

    /**
     * @dev 获取 rec20 代币的释放额度
     */
    function totalReleased(IERC20 token) public view returns (uint256) {
        return _erc20TotalReleased[token];
    }

    /**
     * @dev 获取账户股份
     */
    function shares(address account) public view returns (uint256) {
        return _shares[account];
    }

    /**
     * @dev 获取账户主笔已经释放的额度
     */
    function released(address account) public view returns (uint256) {
        return _released[account];
    }

    /**
     * @dev 获取账户 rec20 已经释放的额度
     */
    function released(IERC20 token, address account) public view returns (uint256) {
        return _erc20Released[token][account];
    }

    /**
     * @dev 根据下标获取收益人的地址
     */
    function payee(uint256 index) public view returns (address) {
        return _payees[index];
    }

    /**
     * @dev 主币收益
     * 根据 account 账户所占比释放的股份，向 account 账户发放收益
     */
    function release(address payable account) public virtual {
        // 发送者必须占比的股份大于 0
        require(_shares[account] > 0, "PaymentSplitter: account has no shares");

        // 当前额度 + 已经释放的额度 = totalReceived 总释放额度
        uint256 totalReceived = address(this).balance + totalReleased();
        // 获取 account 地址可提取的代币
        uint256 payment = _pendingPayment(account, totalReceived, released(account));

        require(payment != 0, "PaymentSplitter: account is not due payment");

        // account 地址提取释放代币累加
        _released[account] += payment;
        // 总释放代币累加
        _totalReleased += payment;
        // 转入
        Address.sendValue(account, payment);
        emit PaymentReleased(account, payment);
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of `token` tokens they are owed, according to their
     * percentage of the total shares and their previous withdrawals. `token` must be the address of an IERC20
     * contract.
     */
    function release(IERC20 token, address account) public virtual {
        require(_shares[account] > 0, "PaymentSplitter: account has no shares");

        uint256 totalReceived = token.balanceOf(address(this)) + totalReleased(token);
        uint256 payment = _pendingPayment(account, totalReceived, released(token, account));

        require(payment != 0, "PaymentSplitter: account is not due payment");

        _erc20Released[token][account] += payment;
        _erc20TotalReleased[token] += payment;

        SafeERC20.safeTransfer(token, account, payment);
        emit ERC20PaymentReleased(token, account, payment);
    }

    /**
     * @dev internal logic for computing the pending payment of an `account` given the token historical balances and
     * already released amounts.
     */
    function _pendingPayment(
        address account,
        uint256 totalReceived,
        uint256 alreadyReleased
    ) private view returns (uint256) {
        // 总释放额度 * account持有股份 / 全部股份 == account 可提取释放的代币
        // account 可提取释放的代币 - 已经取出的释放代币 
        // == 这次用户可以提取的代币
        return (totalReceived * _shares[account]) / _totalShares - alreadyReleased;
    }

    /**
     * @dev 向合同添加新的收款人
     * @param account 收款地址
     * @param shares_ 收款股份
     */
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "PaymentSplitter: account is the zero address");
        require(shares_ > 0, "PaymentSplitter: shares are 0");
        // 必须等于 0 ，因为不能添加一个已经存在的收款人
        require(_shares[account] == 0, "PaymentSplitter: account already has shares");

        // 收款人数组
        _payees.push(account);
        // 记录每个收款人的股份
        _shares[account] = shares_;
        // 累加全部股份
        _totalShares = _totalShares + shares_;
        emit PayeeAdded(account, shares_);
    }
}
