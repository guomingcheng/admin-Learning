pragma solidity ^0.8.0;

import "../../openzeppelin@4.4.0/access/AccessControl.sol";

contract AccessControlDemo is AccessControl{

    address public owner;
    //创建角色
    bytes32 public constant ADMIN = keccak256("ADMIN");

    bytes32 public constant ROLEADMIN = keccak256("ROLEADMIN");

    constructor(){

        owner = msg.sender;
        //创建管理员角色
        _setupRole(ROLEADMIN, _msgSender());

        //创建普通角色，并初始化 address
        _setupRole(ADMIN, _msgSender());
        _setupRole(ADMIN, 0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
        //为普通角色设置管理员
        _setRoleAdmin(ADMIN, ROLEADMIN);
        
    }

    function hasRoleTest() public view returns(uint256){
        require(hasRole(ADMIN, msg.sender));
        return 1;
    }

    function onlyRoleTest() public view onlyRole(ADMIN) returns(uint256) {
        return 100;
    }

    function test2(address owner, uint256 ccount) public view returns(bool){
        return true;
    }



}