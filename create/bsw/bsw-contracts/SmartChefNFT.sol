//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//BNF-02
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

interface IBiswapNFT {
    function accrueRB(address user, uint amount) external;
    function tokenFreeze(uint tokenId) external;
    function tokenUnfreeze(uint tokenId) external;
    function getRB(uint tokenId) external view returns(uint);
    function getInfoForStaking(uint tokenId) external view returns(address tokenOwner, bool stakeFreeze, uint robiBoost);
}

contract SmartChefNFT is Ownable, ReentrancyGuard {

    using SafeERC20 for IERC20;

    // 6883390000000000000000020 
    uint public totalRBSupply;                  // 这个是池子质押 NFT 的所有能量的数值
    uint public lastRewardBlock;                // 最后分配的区快
    address[] public listRewardTokens;          // 质押 NFT 奖励的 Token 代币，这里可以是多种的
    IBiswapNFT public nftToken;                 // 质押的 NFT 合约

    // 每个用户质押的信息
    struct UserInfo {
        uint[] stakedTokensId;
        // 2 级别 1020000000000000000000
        // 2 级别 98000000000000000000
        uint stakedRbAmount;               // 用户质押 NFT 所有的能力值总和，池子是根据这个参数来计算用户的产出的代币/  10 20 00 00 00 00 00 00 00 00 00
    }

    // 产出的 Token , 信息结构
    /** BSW
     *   rewardPerBlock         uint256 :  2083333333333333000          | 20.833 Token
         startBlock             uint256 :  17105613
         accTokenPerShare       uint256 :  61582042017704
         rewardsForWithdrawal   uint256 :  333651109989477651756359
         enabled                bool    :  true
     **/

     /** BNB
     *   rewardPerBlock         uint256 :  163194444444000              | 0.0016 Token
         startBlock             uint256 :  17105587
         accTokenPerShare       uint256 :  24079520638
         rewardsForWithdrawal   uint256 :  27907525386716577104
         enabled                bool    :  true
     **/
    /** PNG-USD
     *   rewardPerBlock         uint256 :  83333333333333000            | 0.8333 Token
         startBlock             uint256 :  17105567
         accTokenPerShare       uint256 :  12063316620419
         rewardsForWithdrawal   uint256 :  14458085994602847016061
         enabled                bool    :  true
     **/
    struct RewardToken {
        uint rewardPerBlock;                // 一个区快产出多少代币
        uint startBlock;                    // 表示这个 Token 在这个区快才开始释放奖励
        uint accTokenPerShare;              // 这个表示，每一个 NFT 就可以分配 accTokenPerShare 数量的代币
        uint rewardsForWithdrawal;          // 这个参数记录了这个 TOken 已经释放了多少代币但还没有取出的数额
        bool enabled;                       // true - 激活的; false - 停止的，表示这个 Token 状态是可以产出的
    }

    mapping (address => UserInfo) public userInfo;          // 每个用户质押 NFT 的信息
    mapping (address => mapping(address => uint)) public rewardDebt; //user => ( 产出TOKEN => 已经提取了多少代币);
    mapping (address => RewardToken) public rewardTokens;       // address: 产出代币的地址， RewardToken: 产出代币的信息结构

    event AddNewTokenReward(address token);                                         // 管理人往奖励数组中添加一个 Token 触发的事件
    event DisableTokenReward(address token);                                        // 管理人设置一个奖励的 Token 停止产出，而触发事件
    event ChangeTokenReward(address indexed token, uint rewardPerBlock);            // 管理人设置一个奖励的 Token 启动产出，而触发事件
    event StakeTokens(address indexed user, uint amountRB, uint[] tokensId);        // 用户质押 NFT 而触发的事件
    event UnstakeToken(address indexed user, uint amountRB, uint[] tokensId);       // 用户取出质押的 NFT 而触发的事件
    event EmergencyWithdraw(address indexed user, uint tokenCount);                 // 用户紧急取出质押的 NFT 而触发的事件

    // 设置质押的 NFT 
    constructor(IBiswapNFT _nftToken) {
        nftToken = _nftToken;
    }

    /**
     * 判断一个代币是否在奖励的集合中
     **/
    function isTokenInList(address _token) internal view returns(bool){
        address[] memory _listRewardTokens = listRewardTokens;
        bool thereIs = false;
        for(uint i = 0; i < _listRewardTokens.length; i++){
            if(_listRewardTokens[i] == _token){
                thereIs = true;
                break;
            }
        }
        return thereIs;
    }

    /**
     * 返回用户质押 NFT 的所有 ID
     **/
    function getUserStakedTokens(address _user) public view returns(uint[] memory){
        // 以用户质押 NFT 的数量创建一个长度一样的数组
        uint[] memory tokensId = new uint[](userInfo[_user].stakedTokensId.length);
        // 拷贝
        tokensId = userInfo[_user].stakedTokensId;
        return tokensId;
    }

    /**
     * 返回用户的 stakedRbAmount 属性
     **/
    function getUserStakedRbAmount(address _user) public view returns(uint){
        return userInfo[_user].stakedRbAmount;
    }

    /**
     * 返回所有作为奖励的 Token 
     **/
    function getListRewardTokens() public view returns(address[] memory){
        address[] memory list = new address[](listRewardTokens.length);
        list = listRewardTokens;
        return list;
    }

    /**
     * 管理人在奖励池子中添加一个 Token
     **/
    function addNewTokenReward(address _newToken, uint _startBlock, uint _rewardPerBlock) public onlyOwner {
        // 往奖励集合添加一个新的 Token
        require(_newToken != address(0), "Address shouldn't be 0");
        require(isTokenInList(_newToken) == false, "Token is already in the list");
        listRewardTokens.push(_newToken);

        // 这个属性应该表示，这个 Toekn 是在那个区快才开始奖励
        if(_startBlock == 0){
            rewardTokens[_newToken].startBlock = block.number + 1;
        } else {
            rewardTokens[_newToken].startBlock = _startBlock;
        }
        // 一个区块释放多少 _newToken
        rewardTokens[_newToken].rewardPerBlock = _rewardPerBlock;
        rewardTokens[_newToken].enabled = true;

        emit AddNewTokenReward(_newToken);
    }

    /**
     * 设置这个 Token 不在释放奖励
     **/
    function disableTokenReward(address _token) public onlyOwner {
        require(isTokenInList(_token), "Token not in the list");
        updatePool();
        rewardTokens[_token].enabled = false;
        emit DisableTokenReward(_token);
    }

    /**
     * 设置这个 Token 重新启动奖励
     **/
    function enableTokenReward(address _token, uint _startBlock, uint _rewardPerBlock) public onlyOwner {
        require(isTokenInList(_token), "Token not in the list");
        require(!rewardTokens[_token].enabled, "Reward token is enabled");
        if(_startBlock == 0){
            _startBlock = block.number + 1;
        }
        // 启动的区快必须大于当前的区快
        require(_startBlock >= block.number, "Start block Must be later than current");
        rewardTokens[_token].enabled = true;
        rewardTokens[_token].startBlock = _startBlock;
        rewardTokens[_token].rewardPerBlock = _rewardPerBlock;
        emit ChangeTokenReward(_token, _rewardPerBlock);

        updatePool();
    }

    // 返回区间的区快数量
    function getMultiplier(uint _from, uint _to) public pure returns (uint) {
        if(_to > _from){
            return _to - _from;
        } else {
            return 0;
        }
    }

    /**
     * 用户可以收割的奖励
     **/
    function pendingReward(address _user) external view returns (address[] memory, uint[] memory) {
        // 获取用户质押 NTF 的信息
        UserInfo memory user = userInfo[_user];
        // 根据产出的 Token 的长度创建一个 uint 数组，这个用于存放每个 Token 对应的奖励
        uint[] memory rewards = new uint[](listRewardTokens.length);
        // USER 这个属性等于 0， 就表示不会产出
        if(user.stakedRbAmount == 0){
            return (listRewardTokens, rewards);
        }
        // 获取质押的总量
        uint _totalRBSupply = totalRBSupply;
        // 获取新产出代币的区快
        uint _multiplier = getMultiplier(lastRewardBlock, block.number);
        // 每一个股份等于 0 
        uint _accTokenPerShare = 0;

        // 计算用户产出的 Token 的额度
        for(uint i = 0; i < listRewardTokens.length; i++){
            // 获取产出的 Token 
            address curToken = listRewardTokens[i];
            // 获取产出的 Token 的信息结构
            RewardToken memory curRewardToken = rewardTokens[curToken];

            // _multiplier != 0 , 这里表示还没有产出奖励的区快
            // _totalRBSupply != 0 , 如果质押的总量等于 0， 就不会出现奖励
            // curRewardToken.enabled == true 这个产出的 Token 必须是激活状态
            if (_multiplier != 0 && _totalRBSupply != 0 && curRewardToken.enabled == true) {

                // 这个 Token 可释放的区快
                uint curMultiplier;
                // 如果 Token 的开始释放小于上次更新的区快，那莫就使用 startBlock 为开始计算
                if(getMultiplier(curRewardToken.startBlock, block.number) < _multiplier){
                    curMultiplier = getMultiplier(curRewardToken.startBlock, block.number);
                } else {
                    curMultiplier = _multiplier;
                }
                _accTokenPerShare = curRewardToken.accTokenPerShare +
                // 可释放区快 * 每一个区快产出的多少的 Token / 总质押的 NFT = 每一个 NFT 可以分配多少代币
                (curMultiplier * curRewardToken.rewardPerBlock * 1e12 / _totalRBSupply);
            } else {

                // 如果这个 Token 不在激活状态，那麽返回上一次的即可
                _accTokenPerShare = curRewardToken.accTokenPerShare;
            }
            // user.stakedRbAmount 这个属性应该就是
            rewards[i] = (user.stakedRbAmount * _accTokenPerShare / 1e12) - rewardDebt[_user][curToken];
        }
        return (listRewardTokens, rewards);
    }

    /**
     * 将给定池的奖励变量更新为最新。
     **/
    function updatePool() public {
        // 获取产出代币的区快
        uint multiplier = getMultiplier(lastRewardBlock, block.number);
        // 这一步是解散 gas
        uint _totalRBSupply = totalRBSupply; //Gas safe

        if(multiplier == 0){
            return;
        }
        // 把 lastRewardBlock 值更新为最新
        lastRewardBlock = block.number;
        if(_totalRBSupply == 0){
            return;
        }
        for(uint i = 0; i < listRewardTokens.length; i++){
            // 获取奖励的 Token
            address curToken = listRewardTokens[i];
            // 获取这个 Token 的信息结构
            RewardToken memory curRewardToken = rewardTokens[curToken];
            if(curRewardToken.enabled == false || curRewardToken.startBlock >= block.number){
                continue;
            } else {
                // 获取这个 Token 可以释放的区快
                uint curMultiplier;
                if(getMultiplier(curRewardToken.startBlock, block.number) < multiplier){
                    curMultiplier = getMultiplier(curRewardToken.startBlock, block.number);
                } else {
                    curMultiplier = multiplier;
                }
                // 这个区间区快总释放了多少代币
                uint tokenReward = curRewardToken.rewardPerBlock * curMultiplier;
                // 记录这个 Token 已经释放了多少代币
                rewardTokens[curToken].rewardsForWithdrawal += tokenReward;
                // 每一股累加
                rewardTokens[curToken].accTokenPerShare += (tokenReward * 1e12) / _totalRBSupply;
            }
        }
    }

    /** 
     * 收割
     **/
    function withdrawReward() public {
        _withdrawReward();
    }

    /**
     * 把用户的奖励清空
     **/
    function _updateRewardDebt(address _user) internal {
        for(uint i = 0; i < listRewardTokens.length; i++){
            rewardDebt[_user][listRewardTokens[i]] = userInfo[_user].stakedRbAmount * rewardTokens[listRewardTokens[i]].accTokenPerShare / 1e12;
        }
    }

    /**
     * 内部收割
     **/
    function _withdrawReward() internal {
        // 先把奖励状态更新到现在调用的区块
        updatePool();
        // 用户质押的信息
        UserInfo memory user = userInfo[msg.sender];
        // 质押 NTF 奖励 Token 的 Token 奖励数组
        address[] memory _listRewardTokens = listRewardTokens;
        // 
        if(user.stakedRbAmount == 0){
            return;
        }

        // 将用户每一个代币可以提取的数量转用户
        for(uint i = 0; i < _listRewardTokens.length; i++){
            // 获取这个 Token 的信息的结构
            RewardToken storage curRewardToken = rewardTokens[_listRewardTokens[i]];
            // pending 参数就是用户可以收割代币的值
            uint pending = user.stakedRbAmount * curRewardToken.accTokenPerShare / 1e12 - rewardDebt[msg.sender][_listRewardTokens[i]];
            if(pending > 0){
                // 用户要提走这个释放的代币，所以 rewardsForWithdrawal 参数要减去相应的数额
                curRewardToken.rewardsForWithdrawal -= pending;
                // 更新用户提走的代币数量
                rewardDebt[msg.sender][_listRewardTokens[i]] = user.stakedRbAmount * curRewardToken.accTokenPerShare / 1e12;
                // 向用户转账
                IERC20(_listRewardTokens[i]).safeTransfer(address(msg.sender), pending);
            }
        }
    }

    /**
     * USER 删除数组 index 下标位置的 TokenID
     **/
    function removeTokenIdFromUserInfo(uint index, address user) internal {
        uint[] storage tokensId = userInfo[user].stakedTokensId;
        // 把最后的 TokenId 赋值给 index 下标的位置。就等于删除了 index 下标的 ToeknId
        tokensId[index] = tokensId[tokensId.length - 1];
        // 在把最后的元素弹出，就完成删除操作
        tokensId.pop();
    }

    /**
     * NFT 质押
     **/
    function stake(uint[] calldata tokensId) public nonReentrant {

        // 把用户的奖励转给用户
        _withdrawReward();
        uint depositedRobiBoost = 0;

        // 遍历 Token ID
        for(uint i = 0; i < tokensId.length; i++){
            // 获取这个 TokenId 的拥有者、冻结参数、能量
            (address tokenOwner, bool stakeFreeze, uint robiBoost) = nftToken.getInfoForStaking(tokensId[i]);
            // 令牌的拥有者必须是消息发送者
            require(tokenOwner == msg.sender, "Not token owner");
            // 令牌必须是处于不被冻结的状态
            require(stakeFreeze == false, "Token has already been staked");

            // 冻结这个令牌。以防再次质押挖矿
            nftToken.tokenFreeze(tokensId[i]);
            // 能量相加
            depositedRobiBoost += robiBoost;
            // 把令牌存储到 user 信息结构中
            userInfo[msg.sender].stakedTokensId.push(tokensId[i]);
        }

        // 如果用户质押 NFT 的能量大于 0
        if(depositedRobiBoost > 0){
            // 用户的能量累加
            userInfo[msg.sender].stakedRbAmount += depositedRobiBoost;
            // 池子的能力累加
            totalRBSupply += depositedRobiBoost;
        }

        // 把用户奖励清空到这个区块，其实上面的 _withdrawReward() 已经更新过了
        _updateRewardDebt(msg.sender);
        emit StakeTokens(msg.sender, depositedRobiBoost, tokensId);
    }

    /**
     * 取出质押在池子的 TokemID
     **/
    function unstake(uint[] calldata tokensId) public nonReentrant {
        // 获取用户质押的信息
        UserInfo storage user = userInfo[msg.sender];
        // 用户质押 NFT 的数量必须是大于用户提取 NFT 的数量
        require(user.stakedTokensId.length >= tokensId.length, "Wrong token count given");
        // 用户提出的能量值
        uint withdrawalRBAmount = 0;
        // 把用户可提取的代币转给用户
        _withdrawReward();
        bool findToken;
        // 循环用户取出的 TokenId
        for(uint i = 0; i < tokensId.length; i++){
            // 这个参数保证用户提取质押 TokenId 有一个出现错误，所有的交易都会失败
            findToken = false;
            
            for(uint j = 0; j < user.stakedTokensId.length; j++){
                // 等于，表示用户提取 TokenId, 是质押在池子中
                if(tokensId[i] == user.stakedTokensId[j]){
                    // 删除用户质押的 TokenId
                    removeTokenIdFromUserInfo(j, msg.sender);
                    // 获取这个 TokenId 的能量值
                    withdrawalRBAmount += nftToken.getRB(tokensId[i]);
                    // 取消冻结
                    nftToken.tokenUnfreeze(tokensId[i]);
                    // 成功
                    findToken = true;
                    break;
                }
            }
            // 有一个 TokenId 对不上，所有交易都会回滚
            require(findToken, "Token not staked by user");
        }
        if(withdrawalRBAmount > 0){
            // 用户减去相应的能量值
            user.stakedRbAmount -= withdrawalRBAmount;
            // 总能量值也减去
            totalRBSupply -= withdrawalRBAmount;
            // 更新用户奖励到最新的区快
            _updateRewardDebt(msg.sender);
        }
        emit UnstakeToken(msg.sender, withdrawalRBAmount, tokensId);
    }

    /**
     * 退出时不考虑奖励。仅限紧急情况。
     **/
    function emergencyUnstake() public {
        // 获取用户质押的 TokenID []
        uint[] memory tokensId = userInfo[msg.sender].stakedTokensId;
        // 池子的总能量值减去用户的能量值
        totalRBSupply -= userInfo[msg.sender].stakedRbAmount;
        // 删除用户的信息
        delete userInfo[msg.sender];
        // 删除用户提取代币的记录
        for(uint i = 0; i < listRewardTokens.length; i++){
            delete rewardDebt[msg.sender][listRewardTokens[i]];
        }
        // 解除所有的冻结
        for(uint i = 0; i < tokensId.length; i++){
            nftToken.tokenUnfreeze(tokensId[i]);
        }
        emit EmergencyWithdraw(msg.sender, tokensId.length);
    }

    /**
     * 提取奖励令牌。仅限紧急情况
     **/
    function emergencyRewardTokenWithdraw(address _token, uint256 _amount) public onlyOwner {
        require(IERC20(_token).balanceOf(address(this)) >= _amount, "Not enough balance");
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }


}