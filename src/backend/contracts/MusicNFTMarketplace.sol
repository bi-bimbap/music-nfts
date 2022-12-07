// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MusicNFTMarketplace is ERC721("DAppFi", "DAPP"), Ownable {
    struct MarketItem {
        uint256 tokenId;
        address payable seller;
        uint256 price;
    }

    string public baseURI = "https://bafybeifd5crmyo3cakir4pq3lgnkxdm5txzpl2va26zrvnelbyy257i6wi.ipfs.nftstorage.link/";
    string public baseExtension = ".json";
    address public artist;
    uint256 public royaltyFee;    
    MarketItem[] public marketItems;

    event MarketItemBought(uint256 indexed tokenId, address indexed seller, address buyer, uint256 price);
    event MarketItemRelisted(uint256 indexed tokenId, address indexed seller, uint256 price);

    // initialize royalty fee, arist addr & price of music NFT
    constructor(uint256 _royaltyFee, address _artist, uint256[] memory _prices) payable {
        // check if msg.value is enough to cover total royalty fee for all NFTs
        require(msg.value >= _prices.length * _royaltyFee, "Deployer must pay royalty fee for each token listen on the marketplace");
        royaltyFee = _royaltyFee;
        artist = _artist;
        
        // mint NFT
        for (uint8 i = 0; i < _prices.length; i++) {
            require(_prices[i] > 0, "Price must be > 0");
            _mint(address(this), i);
            marketItems.push(MarketItem(i, payable(msg.sender), _prices[i]));
        }
    }

    // update royalty fee
    function updateRoyaltyFee(uint256 _royaltyFee) external onlyOwner {
        royaltyFee = _royaltyFee;
    }

    // purchase NFT
    // transfer ownership of NFT & funds between parties
    function buyToken(uint256 _tokenId) external payable {
        uint256 price  = marketItems[_tokenId].price;
        address seller = marketItems[_tokenId].seller;

        // check sufficient ETH to purchase NFT
        require(msg.value == price, "Insufficient funds");

        // update seller address to zero address as it is no longer being sold
        marketItems[_tokenId].seller = payable(address(0));

        // transfer NFT ownership from contract -> buyer
        _transfer(address(this), msg.sender, _tokenId);

        // pay royalty to artist
        payable(artist).transfer(royaltyFee);

        // pay ETH to seller
        payable(seller).transfer(msg.value);

        emit MarketItemBought(_tokenId, seller, msg.sender, price);
    }

    // allow someone to resell their NFT
    function resellToken(uint256 _tokenId, uint256 _price) external payable {
        // check sufficient ETH to pay royalty
        require(msg.value == royaltyFee, "Must pay royalty");

        // check _price > 0
        require(_price > 0, "Price must be > 0");

        // update seller address to contract, price to new price
        marketItems[_tokenId].seller = payable(msg.sender);
        marketItems[_tokenId].price = _price;

        // transfer NFT ownership from seller -> contract
        _transfer(msg.sender, address(this), _tokenId);

        // emit event
        emit MarketItemRelisted(_tokenId, msg.sender, _price);
    }

    // fetch all tokens currently listed for sale
    function getAllUnsoldTokens() external view returns(MarketItem[] memory) {
        uint256 unsoldCount = balanceOf(address(this));
        MarketItem[] memory tokens = new MarketItem[](unsoldCount);
        uint8 index;
        
        // token is unsold if seller != address(0)
        for (uint8 i = 0; i < marketItems.length; i++) {
            if (marketItems[i].seller != address(0)) {
                tokens[index] = marketItems[i];
                index++;
            }
        }

        return tokens;
    }

    // fetch all tokens owned by user
    function getMyTokens() external view returns(MarketItem[] memory) {
        uint256 myTokenCount = balanceOf(msg.sender);
        MarketItem[] memory tokens = new MarketItem[](myTokenCount);
        uint8 index;

        for (uint8 i = 0; i < marketItems.length; i++) {
            if (ownerOf(i) == msg.sender) {
                tokens[index] = marketItems[i];
                index++;
            }
        }

        return tokens;
    }

    // internal function that gets the baseURI initialized in the constructor
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}