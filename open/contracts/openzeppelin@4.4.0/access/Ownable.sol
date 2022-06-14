// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)

pragma solidity ^0.8.0;

import "../utils/Context.sol";

/**
 * @dev 拥有者权限
 *
 * 默认的情况下，合约的部署账户是合约的拥有者，后期也是可以通过其他的函数修改，
 * 核心就是 onlyOwner() 修改器，来限制函数的访问
 *
 * =============================================函数集合：--------------------------------------------------------------
 * 
 * owner()                                           public ：获取合约拥有者的地址
 * renounceOwnership()onlyOwner                      public ：修改合约权限
 * transferOwnership(address newOwner)onlyOwner      public ：更换合约拥有者的 owner 地址
 *
 * =============================================函数集合：--------------------------------------------------------------
 *
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev 读取函数
     *
     * 返回合约的拥有者 owner账户
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev 拦截修改器
     *
     * 作用于函数，用于限制函数的访问权限
     */
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev 修改函数
     *
     * 丢弃合约拥有者的权限，owner 转移到零地址
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev 修改函数
     * 
     * 更换合约的拥有者的地址，owner 等于新的 newOwner 地址
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
