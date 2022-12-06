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
}