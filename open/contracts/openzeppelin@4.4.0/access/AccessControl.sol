// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (access/AccessControl.sol)

pragma solidity ^0.8.0;

import "./IAccessControl.sol";
import "../utils/Context.sol";
import "../utils/Strings.sol";
import "../utils/introspection/ERC165.sol";

/**
 * @dev 角色权限访问控制合约
 *
 * 角色由 bytes32 字节作为标识，这个变量应该暴露 public 的。
 * 定义角色的标识符必须是唯一的：
 * ```
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * 角色表示的意思是一组权限，可以为这个角色设置多个 address，通过 {hasRole} 函数来设置访问:
 * ```
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 * {grantRole}
 * 可以通过这个函数为一个 address 动态的授予和撤销角色权限
 * {revokeRole}
 
 * =============================================函数集合：--------------------------------------------------------------
 * 
 * hasRole(bytes32 role, address account)                   ：用于校验 account 地址是否属于 role 角色
 * getRoleAdmin(bytes32 role)                               ：获取 role 的管理员角色
 * grantRole(bytes32 role, address account)                 ：为 role 添加一个账户 account， msg.sender 必须是管理员角色
 * revokeRole(bytes32 role, address account)                ：为 role 移除一个账户 account， msg.sender 必须是管理员角色

 * _setRoleAdmin(bytes32 role, bytes32 adminRole)           : 为 role 角色添加一个管理员角色
 * _setupRole(bytes32 role, address account)                : 为 role 设置一个账户
 *
 * =============================================函数集合：--------------------------------------------------------------
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {

    /**
     * 角色结构定义
     */
    struct RoleData {
        // 为存储的 address 受拟角色的权限
        mapping(address => bool) members;
        // 角色的管理员，可以动态的对这个角色分组 address 的授予和撤销权限
        bytes32 adminRole;

        /** 
         * 有一点需要注意的地方：
         * 如果 role 与 role Admin 设置的 bytes32 相同的话， role 中的每个账户都具备了 role 添加与移除的权限。
         *
         * role 管理员设置规范：
         * 如果一个 role 需要设置管理员的话，需要重新的创建一个 roleAdmin 角色，把一个地址赋拟给这个角色。在把这
         * roleAdmin 设置为管理员，这样，role 的添加与移除权限就只有被 roleAdmin 角色的地址拥有，role 的白明
         * 单地址就不具备添加与移除的权限，只有同行的权限
         */
    }

    // 每个 bytes32 角色指向他的数据存储 
    mapping(bytes32 => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev 拦截校验函数
     * 判断 msg.sender 发送者是否属于 role 角色的分组
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev 校验函数
     * 判断 account 地址是否是属于 role 角色分组
     */
    function hasRole(bytes32 role, address account) public view virtual override returns (bool) {
        return _roles[role].members[account];
    }

    /**
     * @dev Revert with a standard message if `_msgSender()` is missing `role`.
     * Overriding this function changes the behavior of the {onlyRole} modifier.
     *
     * Format of the revert message is described in {_checkRole}.
     *
     * _Available since v4.6._
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Revert with a standard message if `account` is missing `role`.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        Strings.toHexString(uint160(account), 20),
                        " is missing role ",
                        Strings.toHexString(uint256(role), 32)
                    )
                )
            );
        }
    }

    /**
     * @dev 读取函数
     * 读取角色的 bytes32 管理员
     */
    function getRoleAdmin(bytes32 role) public view virtual override returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev 添加账户
     *
     * 为 role 角色添加一个账户，msg.sender 必须是 role 管理员身份
     */
    function grantRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev 移除账户
     *
     * 为 role 角色移除 account 账户，msg.sender 必须是 role 管理员身份
     */
    function revokeRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev 自我移除
     *
     * msg.sender 消息发送者可以通过这个函数来，移除 role 角色权限 
     */
    function renounceRole(bytes32 role, address account) public virtual override {
        require(account == _msgSender(), "AccessControl: can only renounce roles for self");

        _revokeRole(role, account);
    }

    /**
     * @dev 内部设置
     *
     * 通过这个函数，可以为一个角色初始化一个账户
     */
    function _setupRole(bytes32 role, address account) internal virtual {
        _grantRole(role, account);
    }

    /**
     * @dev 设置管理
     *
     * 为 role 这个角色添加一个 adminRole 管理员
     * 只有通过这个内部函数初始化角色的管理员，role 角色才能动态的添加或移除一个 account 账户
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev 设置账户
     *
     * 为 role 这个角色移除一个 account 地址
     */
    function _grantRole(bytes32 role, address account) internal virtual {
        if (!hasRole(role, account)) {
            _roles[role].members[account] = true;
            emit RoleGranted(role, account, _msgSender());
        }
    }

    /**
     * @dev 移除账户
     *
     * 为 role 这个角色添加一个 account 地址
     */
    function _revokeRole(bytes32 role, address account) internal virtual {
        if (hasRole(role, account)) {
            _roles[role].members[account] = false;
            emit RoleRevoked(role, account, _msgSender());
        }
    }
}


