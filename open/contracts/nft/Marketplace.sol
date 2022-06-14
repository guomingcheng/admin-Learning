pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

interface IMarketplace{

    function createAuction(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration
    ) external;

    function settleAuction(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _price
    ) external;

    function cancelAuction(address _nftAddress, uint256 _tokenId) external;

    function cancelAuctionWhenPaused(
        address _nftAddress,
        uint256 _tokenId
    ) external;
}

interface ISwapRouter{
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address [] calldata path,
        address to,
        uint deadline
    ) external returns(uint [] memory amounts);
}

/**
 * ERC721Holder         : 为 Marketplace 合约提供了支持接收 NFT ERC721 代币      
 * Pausable             : 为 MarKetplace 合约提供可暂停功能
 * Ownable              : 为 Marketplace 合同提供了拥有者权限功能
 * ReentrancyGuard      : 为 Marketplace 合约提供了反正重入攻击的功能
 * IMarketplace         : 为 Marketplace 合约提供了要实现的接口
 **/ 
contract Marketplace is ERC721Holder, Pausable, Ownable, ReentrancyGuard ,IMarketplace{

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Auction{
        address seller;                 // 订单的拥有者
        uint256 startingPrice;          // 开始时间的价格，如果开始价格等于结束价格，就表示固定价格拍卖
        uint256 endingPrice;            // 结束时间的价格
        uint256 duration;               // 持续的时间
        uint256 startedAt;              // 订单生成的时间，这个用于判断订单是否是一个有效的
    }

    uint256 public feeCut;              // 每笔订单交易的手续费，百分比单位，0 ~ 10000
    //uint256 public ownerCut;

    IERC20 public priceToken;           // 订单结算支付的代币
    address public feeTo;               // 手续费发送的地址
    uint256 public limitPrice;          // 限价，用户不得上架订单的金额不得超过 limitPrice

    mapping(address => mapping(uint256 => Auction)) public auctions;            // 合约地址与 NFT ID 映射的订单详情
    mapping(address => bool) public supportNFTs;                                // 白名单 NFT, 只有拥有白名单的 NFT 合约才能上架拍卖
    mapping(address => bool) public preSeller;                                  // 白名单地址，拥有白名单的地址上架 NFT 拍卖，可以不受金额限制

    ISwapRouter public swap;                                                    // 去中心化交易所的合约地址
    IERC20  public destroyToken;                                                // 手续费中的比例要销毁的 token
    uint256 public destroyPercent = 3000;                                       // 销毁手续费中的占比，0 ~ 10000，目前常量设置 3000
    address public destroyAddress;                                              // 销毁的代币将发送到这个地址，也可以是空地址

    event AuctionCreated(
        address indexed _nftAddress,
        uint256 indexed _tokenId,
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration,
        address _seller
    );

    event AuctionSuccessful(
        address indexed _nftAddress,
        uint256 indexed _tokenId,
        uint256 _totalPrice,
        address _winner
    );

    event AuctionCancelled(
        address indexed _nftAddress,
        uint256 indexed _tokenId
    );

    constructor(uint256 _ownerCut,uint256 _feeCut,address _priceToken,address _feeTo, uint256 _limitPrice){

        require(_feeCut <= 1000, "! feeCut <= 1000");
        //require(_ownerCut <= 5000, "! ownerCut <= 5000");

        //ownerCut = _ownerCut;
        feeCut = _feeCut;
        priceToken = IERC20(_priceToken);
        feeTo = _feeTo;
        limitPrice = _limitPrice;
    }

    receive() external payable{}

    function getAuction(address _nftAddress, uint256 _tokenId) external view returns(
        address seller,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        uint256 startedAt
    ){
        Auction memory _auction = auctions[_nftAddress][_tokenId];
        require(_isOnAuction(_auction), "! onAuction");

        seller = _auction.seller;
        startingPrice = _auction.startingPrice;
        endingPrice = _auction.endingPrice;
         duration = _auction.duration;
        startedAt = _auction.startedAt;
    }

    function getCurrentPrice(address _nftAddress,uint256 _tokenId) external view returns(uint256){

        Auction memory _auction = auctions[_nftAddress][_tokenId];
        require(_isOnAuction(_auction), "! onAuction");

        return _getCurrentPrice(_auction);
    }

    function createAuction(
        address _nftAddress,
        uint256 _tokenId, 
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration
    )external override nonReentrant whenNotPaused{

        address _seller = msg.sender;

        require(preSeller[_seller] || (_startingPrice < limitPrice && _endingPrice < limitPrice), "can not sell");
        require(supportNFTs[_nftAddress], "no support nft");
        require(_owns(_nftAddress, _seller, _tokenId), "!owner");
        require(_duration >= 1 minutes, "too short");

        IERC721(_nftAddress).safeTransferFrom(_seller, address(this), _tokenId);

        Auction memory _auction = Auction(
            _seller,
            _startingPrice,
            _endingPrice,
            _duration,
            block.timestamp
        );
        auctions[_nftAddress][_tokenId] = _auction;

        emit AuctionCreated(
            _nftAddress,
            _tokenId, 
            _startingPrice,
            _endingPrice,
            _duration, 
            _seller
        );
    }
    function settleAuction(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _price
    ) external override nonReentrant whenNotPaused{

        priceToken.safeTransferFrom(msg.sender, address(this), _price);
        _bid(_nftAddress, _tokenId, _price);
        IERC721(_nftAddress).safeTransferFrom(address(this), msg.sender , _tokenId);

    }

    function cancelAuction(
        address _nftAddress, 
        uint256 _tokenId
    ) external override nonReentrant{

        Auction storage _auction = auctions[_nftAddress][_tokenId];
        require(_isOnAuction(_auction), "!onAuction");
        require(msg.sender == _auction.seller, "!owner");
        _cancelAuction(_nftAddress, _tokenId, _auction.seller);

    }

    function cancelAuctionWhenPaused(
        address _nftAddress,
        uint256 _tokenId
    ) external override whenPaused onlyOwner{

        Auction storage _auction = auctions[_nftAddress][_tokenId];
        require(_isOnAuction(_auction));
        _cancelAuction(_nftAddress, _tokenId, _auction.seller);

    }

//====================================================================================================================================================    

    function _bid(address _nftAddress, uint256 _tokenId, uint256 _bidAmount) internal returns(uint256){

        Auction storage _auction = auctions[_nftAddress][_tokenId];
        require(_isOnAuction(_auction), "! onAuction");

        uint256 _price = _getCurrentPrice(_auction);
        require(_bidAmount >= _price);

        address _seller = _auction.seller;
        _removeAuction(_nftAddress, _tokenId);

        if(_price > 0){
            //uint256 _ownerCut = _computeFee(_price);
            uint256 _feeCut = _computeFee(_price);
            priceToken.safeTransfer(_seller, _price.sub(_feeCut));  // _price.sub(_feeCut).sub(_ownerCut);
            if(_feeCut > 0){
                if(address(swap) != address(0)){
                    uint256 destroyAmount = _feeCut.mul(destroyPercent).div(10000);
                    _feeCut = feeCut.sub(destroyAmount);
                    _swapAndDestroy(destroyAmount);
                }
                priceToken.safeTransfer(feeTo, _feeCut);          // 
            }
            //if(_ownerCut > 0){}
        }

        if(_bidAmount > _price){
            uint256 _bidExcess = _bidAmount.sub(_price);
            priceToken.safeTransfer(msg.sender, _bidExcess);
        }

        emit AuctionSuccessful(
            _nftAddress, 
            _tokenId, 
            _price, 
            msg.sender
        );

        return _price;
    }

    function _computeFee(uint256 _price) internal view returns(uint256){
        return _price.mul(feeCut).div(10000);
    }

    function _removeAuction(address _nftAddress, uint256 _tokenId) internal{
        delete auctions[_nftAddress][_tokenId];
    }

    function _isOnAuction(Auction memory _auction) internal pure returns(bool){
        return (_auction.startedAt > 0);
    }

    function _cancelAuction(address _nftAddress, uint256 _tokenId, address _seller) internal{
        _removeAuction(_nftAddress, _tokenId);
        IERC721(_nftAddress).safeTransferFrom(address(this), _seller, _tokenId);
        emit AuctionCancelled(_nftAddress, _tokenId);
    }

    function _swapAndDestroy(uint256 destroyAmount) internal {
        address [] memory path = new address[](2);
        path[0] = address(priceToken);
        path[1] = address(destroyToken);

        priceToken.approve(address(swap), destroyAmount);
        swap.swapExactTokensForTokens(destroyAmount, 0, path, address(this), block.timestamp);
        uint256 balance = destroyToken.balanceOf(address(this));
        destroyToken.transfer(destroyAddress, balance);
    }

    function _owns(address _nftAddress,address _seller, uint256 _tokenId
        ) internal view returns(bool){
        return IERC721(_nftAddress).ownerOf(_tokenId) == _seller;
    }

    function _getCurrentPrice(Auction memory _auction) internal view returns(uint256){
        
        uint256 _secondsPassed = 0;

        if(block.timestamp > _auction.startedAt){
            _secondsPassed = block.timestamp - _auction.startedAt;
        }
        return _computeCurrentPrice(
            _auction.startingPrice,_auction.endingPrice,
            _auction.duration,_secondsPassed
        );
    }

    function _computeCurrentPrice(
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration,
        uint256 _secondsPassed
    ) internal pure returns(uint256){
        if(_secondsPassed >= _duration){
            return _endingPrice;
        }else{
            if(_startingPrice <= _endingPrice){
                return _endingPrice.sub(_startingPrice).mul(_secondsPassed).div(_duration).add(_startingPrice);
            }else{
                return _startingPrice.sub(
                    _startingPrice.sub(_endingPrice).mul(_secondsPassed).div(_duration)
                    );
            }
        }
    }

//====================================================================================================================================================   

    function setPriceToken(IERC20 _token) external onlyOwner{ priceToken = _token; }

    function setFeeTo(address _feeTo) external onlyOwner{ feeTo = _feeTo; }

    function setLimitPrice(uint256 _limilPrice) external onlyOwner{ limitPrice = _limilPrice; }

    function addSupportNFT(address _nft, bool _ok) external onlyOwner{ supportNFTs[_nft] = _ok; } 

    function addPreSeller(address _user, bool _ok) external onlyOwner{ preSeller[_user] = _ok; }

    function setDestroyAddress(address _destroyAddress) external onlyOwner{ destroyAddress = _destroyAddress; }

    function setDestroyToken(IERC20 _destroyToken) external onlyOwner{ destroyToken = _destroyToken; }

    function setSwapRouter(address _swapRouter) external onlyOwner{
        require(_swapRouter != address(0), "invalid router");
        swap = ISwapRouter(_swapRouter);
    }

    function setDestroyPercent(uint256 _destroyPercent) external onlyOwner{
        require(_destroyPercent <= 10000, "invalid value");
        destroyPercent = _destroyPercent;
    }

    function setFeeCut(uint256 _feeCut) external onlyOwner{
        require(_feeCut <= 1000, "!feeCut");
        feeCut = _feeCut;
    }

   // function setOwnerCut(uint256 _ownerCut) external onlyOwner{
        //require(_own);
    




}
