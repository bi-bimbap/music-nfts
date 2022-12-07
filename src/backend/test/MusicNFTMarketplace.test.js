const { default: lib } = require("@babel/preset-react");
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

    describe("Updating Royalty Fee", function() {
        it("Only deployer should be able to update royalty fee", async function() {
            const fee = toWei(0.2);
            await nftMarketplace.updateRoyaltyFee(fee);
            await expect(nftMarketplace.connect(user1).updateRoyaltyFee(fee)).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await nftMarketplace.royaltyFee()).to.equal(fee);
        });
    });

    describe("Buying Tokens", function() {
        it("Should update seller to zero address, transfer NFT, pay seller, pay royalty to artist and emit a MarketItemBought event", async function() {
            const deployerInitialEthBal = await deployer.getBalance();
            const artistInitialEthBal = await artist.getBalance();
            
            // user1 buys NFT - should emit event
            await expect(nftMarketplace.connect(user1).buyToken(0, { value: prices[0] }))
                .to.emit(nftMarketplace, "MarketItemBought")
                .withArgs(0, deployer.address, user1.address, prices[0]);

            // seller address should be zero address
            const item = await nftMarketplace.marketItems(0);
            expect(item.seller).to.equal("0x0000000000000000000000000000000000000000");

            // NFT owner should be user1
            expect(await nftMarketplace.ownerOf(0)).to.equal(user1.address);

            const deployerFinalEthBal = await deployer.getBalance();
            const artistFinalEthBal = await artist.getBalance();

            // seller should receive payment for NFT
            expect(+fromWei(deployerFinalEthBal)).to.equal(+fromWei(prices[0]) + +fromWei(deployerInitialEthBal));

            // artist should receive royalty
            expect(+fromWei(artistFinalEthBal)).to.equal(+fromWei(royaltyFee) + +fromWei(artistInitialEthBal));
        });

        // it("Should fail when ether amount sent with transaction does not equal asking price", async function () {
        //     // user sent in more ETH than needed
        //     await expect(nftMarketplace.connect(user1).buyToken(1, { value: prices[0] }))
        //         .to.be.revertedWith("Please send the asking price in order to complete the purchase");
        // });
    });

    describe("Reselling Tokens", function() {
        beforeEach(async function () {
            // user1 purchases an item
            await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] });
        });

        it("Should track resale item, incr. ether bal by royalty fee, transfer NFT to marketplace and emit MarketItemRelisted event", async function() {
            const resalePrice = toWei(2);
            const initMarketBal = await ethers.provider.getBalance(nftMarketplace.address);

            // user1 lists NFT for 2 ETH, hoping to flip it & double their money
            await expect(nftMarketplace.connect(user1).resellToken(0, resalePrice, { value: royaltyFee }))
                .to.emit(nftMarketplace, "MarketItemRelisted")
                .withArgs(0, user1.address, resalePrice);

            const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address);

            // final market bal = initial + royalty fee
            expect(+fromWei(finalMarketBal)).to.equal(+fromWei(initMarketBal) + +fromWei(royaltyFee));

            // NFT owner should be marketplace
            expect(await nftMarketplace.ownerOf(0)).to.equal(nftMarketplace.address);

            // check marketItems to ensure fields are updated
            const item = await nftMarketplace.marketItems(0);
            expect(item.tokenId).to.equal(0);
            expect(item.seller).to.equal(user1.address);
            expect(item.price).to.equal(resalePrice);
        });

        it("Should fail if price is set to zero and royalty fee is not paid", async function () {
            // new price = 0
            await expect(nftMarketplace.connect(user1).resellToken(0, 0, { value: royaltyFee }))
                .to.be.revertedWith("Price must be > 0");

            // did not pay royalty
            await expect(nftMarketplace.connect(user1).resellToken(0, toWei(1), { value: 0 }))
                .to.be.revertedWith("Must pay royalty");
        });
    });

    describe("Getter functions", function() {
        let soldItems = [0, 1, 4]
        let ownedByUser1 = [0, 1]
        let ownedByUser2 = [4]

        beforeEach(async function () {
            // user1 purchases item 0
            await (await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })).wait();
            // user1 purchases item 1
            await (await nftMarketplace.connect(user1).buyToken(1, { value: prices[1] })).wait();
            // user2 purchases item 4
            await (await nftMarketplace.connect(user2).buyToken(4, { value: prices[4] })).wait();
        })

        it("getAllUnsoldTokens should fetch all the marketplace items up for sale", async function () {
            const unsoldItems = await nftMarketplace.getAllUnsoldTokens();

            // make sure all returned unsoldItems have filtered out the sold items
            expect(unsoldItems.every(i => !soldItems.some(j => j === i.tokenId.toNumber()))).to.equal(true);

            // check length is correct
            expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true);
        });

        it("getMyTokens should fetch all tokens the user owns", async function () {
            // get items owned by user1
            let myItems = await nftMarketplace.connect(user1).getMyTokens();

            // check that the returned my items array is correct
            expect(myItems.every(i => ownedByUser1.some(j => j === i.tokenId.toNumber()))).to.equal(true);
            expect(ownedByUser1.length === myItems.length).to.equal(true);

            // get items owned by user2
            myItems = await nftMarketplace.connect(user2).getMyTokens();

            // Check that the returned my items array is correct
            expect(myItems.every(i => ownedByUser2.some(j => j === i.tokenId.toNumber()))).to.equal(true);
            expect(ownedByUser2.length === myItems.length).to.equal(true);
        });
    });
});