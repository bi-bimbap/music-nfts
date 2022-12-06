const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (num) => ethers.utils.parseEther(num.toString());
const fromWei = (num) => ethers.utils.formatEther(num);

describe("MusicNFTMarketplace", function() {
    let nftMarketplace;
    let deployer, artist, user1, user2, users;
    let royaltyFee = toWei(0.01) // 1 ETH = 10^18 wei
    let URI = "https://bafybeifd5crmyo3cakir4pq3lgnkxdm5txzpl2va26zrvnelbyy257i6wi.ipfs.nftstorage.link/";
    let prices = [toWei(1), toWei(2), toWei(3), toWei(4), toWei(5)];
    let deploymentFees = toWei(prices.length * 0.01);

    // this is run before each test in a describe
    beforeEach(async function() {
        // get ContractFactory & Signers
        const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");
        [deployer, artist, user1, user2, ...users] = await ethers.getSigners();

        // deploy smart contract
        // pass in constructor parameters
        nftMarketplace = await NFTMarketplaceFactory.deploy(
            royaltyFee,
            artist.address,
            prices,
            { value: deploymentFees } // send ETH for royalty fees to smart contract
        );
    });

    describe("Deployment", function() {
        it("Should track name, symbol, URI, royalty fee & artist", async function() {
            const nftName = "DAppFi";
            const nftSymbol = "DAPP";
            expect(await nftMarketplace.name()).to.equal(nftName);
            expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
            expect(await nftMarketplace.baseURI()).to.equal(URI);
            expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
            expect(await nftMarketplace.artist()).to.equal(artist.address);
        });
    
        it("Should mint then list all the music NFTs", async function() {
            // should have 5 NFTs
            expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(5);
    
            // get each item from marketItems arr then check fields to ensure they are correct
            await Promise.all(prices.map(async (i, indx) => {
                const item = await nftMarketplace.marketItems(indx);
                expect(item.tokenId).to.equal(indx);
                expect(item.seller).to.equal(deployer.address);
                expect(item.price).to.equal(i);
            }));
        });
        
        // ETH balance should be enough to cover deployment fees
        it("ETH balance === deployment fees", async function() {
            expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees);
        });
    });
});
