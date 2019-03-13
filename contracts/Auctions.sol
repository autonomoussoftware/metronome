/*
    The MIT License (MIT)

    Copyright 2018 - 2019, Autonomous Software.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
pragma solidity ^0.4.21;

import "./SafeMath.sol";
import "./Owned.sol";
import "./Proceeds.sol";
import "./Pricer.sol";
import "./METToken.sol";
import "./TokenLocker.sol";


/// @title Auction contract. Send QTUM to the contract address and buy MET. 
contract Auctions is Pricer, Owned {

    using SafeMath for uint256;
    METToken public token;
    Proceeds public proceeds;
    address[] public founders;
    mapping(address => TokenLocker) public tokenLockers;
    uint internal constant DAY_IN_SECONDS = 86400;
    uint internal constant DAY_IN_MINUTES = 1440;
    uint public genesisTime;
    uint public lastPurchaseTick;
    uint public lastPurchasePrice;
    uint public constant INITIAL_GLOBAL_DAILY_SUPPLY = 2880 * METDECMULT;
    uint public INITIAL_FOUNDER_SUPPLY = 1999999 * METDECMULT;
    uint public INITIAL_AC_SUPPLY = 1 * METDECMULT;
    uint public totalMigratedOut = 0;
    uint public totalMigratedIn = 0;
    uint public timeScale = 1;
    uint public constant INITIAL_SUPPLY = 10000000 * METDECMULT;
    uint public mintable = INITIAL_SUPPLY;
    uint public initialAuctionDuration = 7 days;
    uint public initialAuctionEndTime;
    uint public dailyAuctionStartTime;
    uint public constant DAILY_PURCHASE_LIMIT = 1000e8;
    mapping (address => uint) internal purchaseInTheAuction;
    mapping (address => uint) internal lastPurchaseAuction;
    bool public minted;
    bool public initialized;
    uint public globalSupplyAfterPercentageLogic = 52598080 * METDECMULT;
    uint public constant AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS = 14791;
    bytes8 public chain = "QTUM";
    event LogAuctionFundsIn(address indexed sender, uint amount, uint tokens, uint purchasePrice, uint refund);

    function Auctions() public {
        mintable = INITIAL_SUPPLY - 2000000 * METDECMULT;
    }

    /// @notice Payable function to buy MET in descending price auction
    function () public payable running {
        require(msg.value > 0);
        
        uint amountForPurchase = msg.value;
        uint excessAmount;

        // start next day auction if currentAuction() > whichAuction(lastPurchaseTick)
        restartAuction();

        if (isInitialAuctionEnded()) {
            require(now >= dailyAuctionStartTime);
            if (lastPurchaseAuction[msg.sender] < currentAuction()) {
                if (amountForPurchase > DAILY_PURCHASE_LIMIT) {
                    excessAmount = amountForPurchase.sub(DAILY_PURCHASE_LIMIT);
                    amountForPurchase = DAILY_PURCHASE_LIMIT;
                }           
                purchaseInTheAuction[msg.sender] = msg.value;
                lastPurchaseAuction[msg.sender] = currentAuction();
            } else {
                require(purchaseInTheAuction[msg.sender] < DAILY_PURCHASE_LIMIT);
                if (purchaseInTheAuction[msg.sender].add(amountForPurchase) > DAILY_PURCHASE_LIMIT) {
                    excessAmount = (purchaseInTheAuction[msg.sender].add(amountForPurchase)).sub(DAILY_PURCHASE_LIMIT);
                    amountForPurchase = amountForPurchase.sub(excessAmount);
                }
                purchaseInTheAuction[msg.sender] = purchaseInTheAuction[msg.sender].add(msg.value);
            }
        }

        uint _currentTick = currentTick();

        uint weiPerToken;
        uint tokens;
        uint refund;
        (weiPerToken, tokens, refund) = calcPurchase(amountForPurchase, _currentTick);
        require(tokens > 0);

        if (now < initialAuctionEndTime && (token.totalSupply()).add(tokens) >= INITIAL_SUPPLY) {
            initialAuctionEndTime = now;
            dailyAuctionStartTime = ((initialAuctionEndTime / 1 days) + 1) * 1 days;
        }

        lastPurchaseTick = _currentTick;
        lastPurchasePrice = weiPerToken;

        assert(tokens <= mintable);
        mintable = mintable.sub(tokens);

        assert(refund <= amountForPurchase);
        uint qtumForProceeds = amountForPurchase.sub(refund);

        proceeds.handleFund.value(qtumForProceeds)();

        require(token.mint(msg.sender, tokens));

        refund = refund.add(excessAmount);
        if (refund > 0) {
            if (purchaseInTheAuction[msg.sender] > 0) {
                purchaseInTheAuction[msg.sender] = purchaseInTheAuction[msg.sender].sub(refund);
            }
            msg.sender.transfer(refund);
        }
        emit LogAuctionFundsIn(msg.sender, qtumForProceeds, tokens, lastPurchasePrice, refund);
    }

    modifier running() {
        require(isRunning());
        _;
    }

    function isRunning() public constant returns (bool) {
        return (block.timestamp >= genesisTime && genesisTime > 0);
    }

    /// @notice current tick(minute) of the metronome clock
    /// @return tick count
    function currentTick() public view returns(uint) {
        return whichTick(block.timestamp);
    }

    /// @notice current auction
    /// @return auction count 
    function currentAuction() public view returns(uint) {
        return whichAuction(currentTick());
    }

    /// @notice tick count at the timestamp t. 
    /// @param t timestamp
    /// @return tick count
    function whichTick(uint t) public view returns(uint) {
        if (genesisTime > t) { 
            revert(); 
        }
        return (t - genesisTime) * timeScale / 1 minutes;
    }

    /// @notice Auction count at given the timestamp t
    /// @param _tick timestamp
    /// @return Auction count
    function whichAuction(uint _tick) public view returns(uint) {
        if (whichTick(dailyAuctionStartTime) > _tick) {
            return 0;
        } else {
            return ((_tick - whichTick(dailyAuctionStartTime)) / DAY_IN_MINUTES) + 1;
        }
    }

    /// @notice one single function telling everything about Metronome Auction
    function heartbeat() public view returns (
        bytes8 _chain,
        address auctionAddr,
        address convertAddr,
        address tokenAddr,
        uint minting,
        uint totalMET,
        uint proceedsBal,
        uint currTick,
        uint currAuction,
        uint nextAuctionGMT,
        uint genesisGMT,
        uint currentAuctionPrice,
        uint _dailyMintable,
        uint _lastPurchasePrice) {
        _chain = chain;
        convertAddr = proceeds.autonomousConverter();
        tokenAddr = token;
        auctionAddr = this;
        totalMET = token.totalSupply();
        proceedsBal = address(proceeds).balance;

        currTick = currentTick();
        currAuction = currentAuction();
        if (currAuction == 0) {
            nextAuctionGMT = dailyAuctionStartTime;
        } else {
            nextAuctionGMT = (currAuction * DAY_IN_SECONDS) / timeScale + dailyAuctionStartTime;
        }
        genesisGMT = genesisTime;

        currentAuctionPrice = currentPrice();
        _dailyMintable = dailyMintable();
        minting = currentMintable();
        _lastPurchasePrice = lastPurchasePrice;
    }

    /// @notice Skip Initialization and minting if we're not the OG Metronome
    /// @param _token MET token contract address
    /// @param _proceeds Address of Proceeds contract
    /// @param _genesisTime The block.timestamp when first auction started on OG chain
    /// @param _minimumPrice Nobody can buy tokens for less than this price
    /// @param _startingPrice Start price of MET when first auction starts
    /// @param _timeScale time scale factor for auction. will be always 1 in live environment
    /// @param _chain chain where this contract is being deployed
    /// @param _initialAuctionEndTime  Initial Auction end time in qtum chain. 
    function skipInitBecauseIAmNotOg(address _token, address _proceeds, uint _genesisTime, 
        uint _minimumPrice, uint _startingPrice, uint _timeScale, bytes8 _chain, 
        uint _initialAuctionEndTime) public onlyOwner returns (bool) {
        require(!minted);
        require(!initialized);
        require(_timeScale != 0);
        require(address(token) == 0x0 && _token != 0x0);
        require(address(proceeds) == 0x0 && _proceeds != 0x0);
        initPricer();

        // minting substitute section
        token = METToken(_token);
        proceeds = Proceeds(_proceeds);

        INITIAL_FOUNDER_SUPPLY = 0;
        INITIAL_AC_SUPPLY = 0;
        mintable = 0;  // 

        // initial auction substitute section
        genesisTime = _genesisTime;
        initialAuctionEndTime = _initialAuctionEndTime;

        // if initialAuctionEndTime is midnight, then daily auction will start immediately
        // after initial auction.
        if (initialAuctionEndTime == (initialAuctionEndTime / 1 days) * 1 days) {
            dailyAuctionStartTime = initialAuctionEndTime;
        } else {
            dailyAuctionStartTime = ((initialAuctionEndTime / 1 days) + 1) * 1 days;
        }

        lastPurchaseTick = 0;

        if (_minimumPrice > 0) {
            minimumPrice = _minimumPrice;
        }

        timeScale = _timeScale;

        if (_startingPrice > 0) {
            lastPurchasePrice = _startingPrice * 1e8;
        } else {
            lastPurchasePrice = 2e8;
        }
        chain = _chain;
        minted = true;
        initialized = true;
        return true;
    }

    /// @notice Initialize Auctions parameters
    /// @param _startTime The block.timestamp when first auction starts
    /// @param _minimumPrice Nobody can buy tokens for less than this price
    /// @param _startingPrice Start price of MET when first auction starts
    /// @param _timeScale time scale factor for auction. will be always 1 in live environment
    function initAuctions(uint _startTime, uint _minimumPrice, uint _startingPrice, uint _timeScale) 
        public onlyOwner returns (bool) 
    {
        require(minted);
        require(!initialized);
        require(_timeScale != 0);
        initPricer();
        if (_startTime > 0) { 
            genesisTime = (_startTime / (1 minutes)) * (1 minutes) + 60;
        } else {
            genesisTime = block.timestamp + 60 - (block.timestamp % 60);
        }

        initialAuctionEndTime = genesisTime + initialAuctionDuration;

        // if initialAuctionEndTime is midnight, then daily auction will start immediately
        // after initial auction.
        if (initialAuctionEndTime == (initialAuctionEndTime / 1 days) * 1 days) {
            dailyAuctionStartTime = initialAuctionEndTime;
        } else {
            dailyAuctionStartTime = ((initialAuctionEndTime / 1 days) + 1) * 1 days;
        }

        lastPurchaseTick = 0;

        if (_minimumPrice > 0) {
            minimumPrice = _minimumPrice;
        }

        timeScale = _timeScale;

        if (_startingPrice > 0) {
            lastPurchasePrice = _startingPrice * 1e8;
        } else {
            lastPurchasePrice = 2e8;
        }

        for (uint i = 0; i < founders.length; i++) {
            TokenLocker tokenLocker = tokenLockers[founders[i]];
            tokenLocker.lockTokenLocker();
        }
        
        initialized = true;
        return true;
    }

    function createTokenLocker(address _founder, address _token) public onlyOwner {
        require(_token != 0x0);
        require(_founder != 0x0);
        founders.push(_founder);
        TokenLocker tokenLocker = new TokenLocker(address(this), _token);
        tokenLockers[_founder] = tokenLocker;
        tokenLocker.changeOwnership(_founder);
    }

    /// @notice Mint initial supply for founder and move to token locker
    /// @param _founders Left 160 bits are the founder address and the right 96 bits are the token amount.
    /// @param _token MET token contract address
    /// @param _proceeds Address of Proceeds contract
    function mintInitialSupply(uint[] _founders, address _token, 
        address _proceeds, address _autonomousConverter) public onlyOwner returns (bool) 
    {
        require(!minted);
        require(_founders.length != 0);
        require(address(token) == 0x0 && _token != 0x0);
        require(address(proceeds) == 0x0 && _proceeds != 0x0);
        require(_autonomousConverter != 0x0);

        token = METToken(_token);
        proceeds = Proceeds(_proceeds);

        // _founders will be minted into individual token lockers
        uint foundersTotal;
        for (uint i = 0; i < _founders.length; i++) {
            address addr = address(_founders[i] >> 96);
            require(addr != 0x0);
            uint amount = _founders[i] & ((1 << 96) - 1);
            require(amount > 0);
            TokenLocker tokenLocker = tokenLockers[addr];
            require(token.mint(address(tokenLocker), amount));
            tokenLocker.deposit(addr, amount);
            foundersTotal = foundersTotal.add(amount);
        }

        // reconcile minted total for founders
        require(foundersTotal == INITIAL_FOUNDER_SUPPLY);

        // mint a small amount to the AC
        require(token.mint(_autonomousConverter, INITIAL_AC_SUPPLY));

        minted = true;
        return true;
    }

    /// @notice Suspend auction if not started yet
    function stopEverything() public onlyOwner {
        if (genesisTime < block.timestamp) {
            revert(); 
        }
        genesisTime = genesisTime + 1000 years;
        initialAuctionEndTime = genesisTime;
        dailyAuctionStartTime = genesisTime;
    }

    /// @notice Return information about initial auction status.
    function isInitialAuctionEnded() public view returns (bool) {
        return (initialAuctionEndTime != 0 && 
            (now >= initialAuctionEndTime || token.totalSupply() >= INITIAL_SUPPLY));
    }

    /// @notice Global MET supply
    function globalMetSupply() public view returns (uint) {

        uint currAuc = currentAuction();
        if (currAuc > AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS) {
            return globalSupplyAfterPercentageLogic;
        } else {
            return INITIAL_SUPPLY.add(INITIAL_GLOBAL_DAILY_SUPPLY.mul(currAuc));
        }
    }

    /// @notice Global MET daily supply. Daily supply is greater of 1) 2880 2)2% of then outstanding supply per year.
    /// @dev 2% logic will kicks in at 14792th auction. 
    function globalDailySupply() public view returns (uint) {
        uint dailySupply = INITIAL_GLOBAL_DAILY_SUPPLY;
        uint thisAuction = currentAuction();

        if (thisAuction > AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS) {
            uint lastAuctionPurchase = whichAuction(lastPurchaseTick);
            uint recentAuction = AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS + 1;
            if (lastAuctionPurchase > recentAuction) {
                recentAuction = lastAuctionPurchase;
            }

            uint totalAuctions = thisAuction - recentAuction;
            if (totalAuctions > 1) {
                // derived formula to find close to accurate daily supply when some auction missed. 
                uint factor = 36525 + ((totalAuctions - 1) * 2);
                dailySupply = (globalSupplyAfterPercentageLogic.mul(2).mul(factor)).div(36525 ** 2);

            } else {
                dailySupply = globalSupplyAfterPercentageLogic.mul(2).div(36525);
            }

            if (dailySupply < INITIAL_GLOBAL_DAILY_SUPPLY) {
                dailySupply = INITIAL_GLOBAL_DAILY_SUPPLY; 
            }
        }

        return dailySupply;
    }

    /// @notice Current price of MET in current auction
    /// @return weiPerToken 
    function currentPrice() public constant returns (uint weiPerToken) {
        weiPerToken = calcPriceAt(currentTick());
    }

    /// @notice Daily mintable MET in current auction
    function dailyMintable() public constant returns (uint) {
        return nextAuctionSupply(0);
    }

    /// @notice Total tokens on this chain
    function tokensOnThisChain() public view returns (uint) {
        uint totalSupply = token.totalSupply();
        uint currMintable = currentMintable();
        return totalSupply.add(currMintable);
    }

    /// @notice Current mintable MET in auction
    function currentMintable() public view returns (uint) {
        uint currMintable = mintable;
        uint currAuction = currentAuction();
        uint totalAuctions = currAuction.sub(whichAuction(lastPurchaseTick));
        if (totalAuctions > 0) {
            currMintable = mintable.add(nextAuctionSupply(totalAuctions));
        }
        return (currMintable.add(token.leakage()));
    }

    /// @notice prepare auction when first import is done on a non ETH chain
    function prepareAuctionForNonOGChain() public {
        require(msg.sender == address(token.tokenPorter()) || msg.sender == address(token));
        require(token.totalSupply() == 0);
        require(chain != "ETH");
        lastPurchaseTick = currentTick();
    }

    /// @notice Find out what the results would be of a prospective purchase
    /// @param _wei Amount of wei the purchaser will pay
    /// @param _timestamp Prospective purchase timestamp
    /// @return weiPerToken expected MET token rate
    /// @return tokens Expected token for a prospective purchase
    /// @return refund Wei refund the purchaser will get if amount is excess and MET supply is less
    function whatWouldPurchaseDo(uint _wei, uint _timestamp) public constant
        returns (uint weiPerToken, uint tokens, uint refund)
    {
        weiPerToken = calcPriceAt(whichTick(_timestamp));
        uint calctokens = METDECMULT.mul(_wei).div(weiPerToken);
        tokens = calctokens;
        if (calctokens > mintable) {
            tokens = mintable;
            uint weiPaying = mintable.mul(weiPerToken).div(METDECMULT);
            refund = _wei.sub(weiPaying);
        }
    }

    /// @notice start the next day's auction. Forward proceeding and update mintable.
    /// This is also called by tokenPorter contract during export/import so that mintable 
    /// is updated correctly before moving tokens.
    function restartAuction() public returns (bool) {
        uint thisAuction = currentAuction();
        if (thisAuction > whichAuction(lastPurchaseTick)) {
            proceeds.closeAuction();
            uint time;
            uint price;
            uint auctionTokens;
            (time, price, auctionTokens) = nextAuction();
            lastPurchasePrice = price;
            lastPurchaseTick = whichTick(time);
            mintable = mintable.add(auctionTokens).add(token.leakage());
            token.resetLeakage();
            if (thisAuction > AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS) {
                globalSupplyAfterPercentageLogic = globalSupplyAfterPercentageLogic.add(globalDailySupply());
            }
            return true;
        }
        return false;
    }
    
    /// @notice Return the information about the next auction
    /// @return _startTime Start time of next auction
    /// @return _startPrice Start price of MET in next auction
    /// @return _auctionTokens  MET supply in next auction
    function nextAuction() internal constant returns(uint _startTime, uint _startPrice, uint _auctionTokens) {
        if (block.timestamp < genesisTime) {
            _startTime = genesisTime;
            _startPrice = lastPurchasePrice;
            _auctionTokens = mintable;
            return;
        }

        uint recentAuction = whichAuction(lastPurchaseTick);
        uint currAuc = currentAuction();
        uint totalAuctions = currAuc - recentAuction;
        _startTime = dailyAuctionStartTime;
        if (currAuc > 1) {
            _startTime = auctionStartTime(currentTick());
        }

        _auctionTokens = nextAuctionSupply(totalAuctions);

        if (totalAuctions > 1) {
            _startPrice = lastPurchasePrice / 100 + 1;
        } else {
            if (mintable == 0 || totalAuctions == 0) {
                // Sold out scenario or someone querying projected start price of next auction
                _startPrice = (lastPurchasePrice * 2) + 1;   
            } else {
                // Timed out and all tokens not sold.
                if (currAuc == 1) {
                    // If initial auction timed out then price before start of new auction will touch floor price
                    _startPrice = minimumPrice * 2;
                } else {
                    // Descending price till end of auction and then multiply by 2
                    uint tickWhenAuctionEnded = whichTick(_startTime);
                    uint numTick = 0;
                    if (tickWhenAuctionEnded > lastPurchaseTick) {
                        numTick = tickWhenAuctionEnded - lastPurchaseTick;
                    }
                    _startPrice = priceAt(lastPurchasePrice, numTick) * 2;
                }
                
                
            }
        }
    }

    /// @notice Calculate results of a purchase
    /// @param _wei Amount of wei the purchaser will pay
    /// @param _t Prospective purchase tick
    /// @return weiPerToken expected MET token rate
    /// @return tokens Expected token for a prospective purchase
    /// @return refund Wei refund the purchaser will get if amount is excess and MET supply is less
    function calcPurchase(uint _wei, uint _t) internal view returns (uint weiPerToken, uint tokens, uint refund)
    {
        require(_t >= lastPurchaseTick);
        uint numTicks = _t - lastPurchaseTick;
        if (isInitialAuctionEnded()) {
            weiPerToken = priceAt(lastPurchasePrice, numTicks);
        } else {
            weiPerToken = priceAtInitialAuction(lastPurchasePrice, numTicks);
        }

        uint calctokens = METDECMULT.mul(_wei).div(weiPerToken);
        tokens = calctokens;
        if (calctokens > mintable) {
            tokens = mintable;
            uint qtumPaying = mintable.mul(weiPerToken).div(METDECMULT);
            refund = _wei.sub(qtumPaying);
        }
    }

    /// @notice MET supply for next Auction also considering  carry forward met.
    /// @param totalAuctionMissed auction count when no purchase done.
    function nextAuctionSupply(uint totalAuctionMissed) internal view returns (uint supply) {
        uint thisAuction = currentAuction();
        uint tokensHere = token.totalSupply().add(mintable).add(token.leakage());
        supply = INITIAL_GLOBAL_DAILY_SUPPLY;
        uint dailySupplyAtLastPurchase;
        if (thisAuction > AUCTION_WHEN_PERCENTAGE_LOGIC_STARTS) {
            supply = globalDailySupply();
            if (totalAuctionMissed > 1) {
                dailySupplyAtLastPurchase = globalSupplyAfterPercentageLogic.mul(2).div(36525);
                supply = dailySupplyAtLastPurchase.add(supply).mul(totalAuctionMissed).div(2);
            } 
            supply = (supply.mul(tokensHere)).div(globalSupplyAfterPercentageLogic);
        } else {
            if (totalAuctionMissed > 1) {
                supply = supply.mul(totalAuctionMissed);
            }
            uint previousGlobalMetSupply = 
            INITIAL_SUPPLY.add(INITIAL_GLOBAL_DAILY_SUPPLY.mul(whichAuction(lastPurchaseTick)));
            supply = (supply.mul(tokensHere)).div(previousGlobalMetSupply);
        
        }
    }

    /// @notice price at a number of minutes out in Initial auction and daily auction
    /// @param _tick Metronome tick
    /// @return weiPerToken
    function calcPriceAt(uint _tick) internal constant returns (uint weiPerToken) {
        uint recentAuction = whichAuction(lastPurchaseTick);
        uint totalAuctions = whichAuction(_tick).sub(recentAuction);
        uint prevPrice;

        uint numTicks = 0;

        // Auction is sold out and metronome clock is in same auction
        if (mintable == 0 && totalAuctions == 0) {
            return lastPurchasePrice;
        }

        // Metronome has missed one auction ie no purchase in last auction
        if (totalAuctions > 1) {
            prevPrice = lastPurchasePrice / 100 + 1;
            numTicks = numTicksSinceAuctionStart(_tick);
        } else if (totalAuctions == 1) {
            // Metronome clock is in new auction, next auction
            // previous auction sold out
            if (mintable == 0) {
                prevPrice = lastPurchasePrice * 2;
            } else {
                // previous auctions timed out
                // first daily auction
                if (whichAuction(_tick) == 1) {
                    prevPrice = minimumPrice * 2;
                } else {
                    prevPrice = priceAt(lastPurchasePrice, numTicksTillAuctionStart(_tick)) * 2;
                }
            }
            numTicks = numTicksSinceAuctionStart(_tick);
        } else {
            //Auction is running
            prevPrice = lastPurchasePrice;
            numTicks = _tick - lastPurchaseTick;
        }

        require(numTicks >= 0);

        if (isInitialAuctionEnded()) {
            weiPerToken = priceAt(prevPrice, numTicks);
        } else {
            weiPerToken = priceAtInitialAuction(prevPrice, numTicks);
        }
    }

    /// @notice Calculate number of ticks elapsed between auction start time and given tick.
    /// @param _tick Given metronome tick
    function numTicksSinceAuctionStart(uint _tick) private view returns (uint ) {
        uint currentAuctionStartTime = auctionStartTime(_tick);
        return _tick - whichTick(currentAuctionStartTime);
    }
    
    /// @notice Calculate number of ticks elapsed between lastPurchaseTick and auctions start time of given tick.
    /// @param _tick Given metronome tick
    function numTicksTillAuctionStart(uint _tick) private view returns (uint) {
        uint currentAuctionStartTime = auctionStartTime(_tick);
        return whichTick(currentAuctionStartTime) - lastPurchaseTick;
    }

    /// @notice First calculate the auction which contains the given tick and then calculate
    /// auction start time of given tick.
    /// @param _tick Metronome tick
    function auctionStartTime(uint _tick) private view returns (uint) {
        return ((whichAuction(_tick)) * 1 days) / timeScale + dailyAuctionStartTime - 1 days;
    }
}