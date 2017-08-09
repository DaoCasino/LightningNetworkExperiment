pragma solidity ^ 0.4 .13;

contract ERC20 {
    function transfer(address _to, uint256 _value);

    function transferFrom(address _from, address _to, uint256 _value) returns(bool success);
}

contract gameChannel {

    ERC20 token = ERC20(0x95a48dca999c89e4e284930d9b9af973a7481287);

    struct Channel {
        address player;
        address bankroller;
        uint playerDeposit;
        uint bankrollDeposit;
        uint nonce;
        uint endTime;
        bytes32 disputSeed;
    }

    mapping(bytes32 => Channel) public channels;
    mapping(bytes32 => bool) public usedRandom;

    modifier timeout(Channel storage self) {
        require(self.endTime <= block.number);
        _;
    }

    function open(bytes32 id, address player, uint playerDeposit, uint bankrollDeposit, uint nonce, uint time, bytes sig) {
        var (r, s, v) = signatureSplit(sig);
        assert(ecrecover(sha3(id, player, playerDeposit, bankrollDeposit, nonce, time), v, r, s) == player);
        assert(token.transferFrom(player, this, playerDeposit));
        assert(token.transferFrom(msg.sender, this, bankrollDeposit));
        channels[id] = Channel(player, msg.sender, playerDeposit, bankrollDeposit, nonce, block.number + time, 0);
    }

    function recoverSigner(bytes32 h, bytes signature) returns(address) {
        var (r, s, v) = signatureSplit(signature);
        return ecrecover(h, v, r, s);
    }

    function update(bytes32 id, bytes32 seed, uint nonce, uint bet, uint chance, bytes sig, bytes sigseed) timeout(channels[id]) {
        
        address seedSigner = recoverSigner(seed, sigseed);
        address stateSigner = recoverSigner(sha3(id, seed, nonce, bet, chance) , sig);
        
        Channel memory c = channels[id];
        
        assert(msg.sender == c.player || msg.sender == c.bankroller);
        assert(stateSigner != msg.sender);
        assert(c.bankroller == seedSigner);
        assert(!usedRandom[seed]);

        uint profit = (bet * (65536 - 1310) / chance) - bet;
        uint rnd = uint256(sha3(sigseed)) % 65536;

        if (profit > c.bankrollDeposit) {
            //TODO profit = deposit or profit = maxProfit
        }

        if (rnd < chance) {
            // _________Player won!____________________
            channels[id].bankrollDeposit -= profit;
            channels[id].playerDeposit += profit;
        } else {
            // _________Player lose!___________________
            channels[id].playerDeposit -= bet;
            channels[id].bankrollDeposit += bet;
        }
        usedRandom[seed] = true;
    }

    function disput(bytes32 id, bytes32 seed, uint nonce, uint bet, uint chance, bytes sig) timeout(channels[id]) {

    }

    function closeByConsent(bytes32 id, uint playerDeposit, uint bankrollDeposit, uint nonce, bytes sig)  timeout(channels[id]) {
        address signer = recoverSigner(sha3(id, playerDeposit, bankrollDeposit, nonce),sig);
        Channel memory c = channels[id];
        assert(nonce == 0);
        assert(signer != msg.sender && signer == c.player || signer == c.bankroller);
    
        token.transfer(c.player, c.playerDeposit);
        token.transfer(c.bankroller, c.bankrollDeposit);
        delete channels[id];
    }

    function closeByTime(bytes32 id){
        Channel memory c = channels[id];
        assert(c.endTime < block.number)
        token.transfer(c.player, c.playerDeposit);
        token.transfer(c.bankroller, c.bankrollDeposit);
        delete channels[id];
    }

    function signatureSplit(bytes signature) returns(bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r: = mload(add(signature, 32))
            s: = mload(add(signature, 64))
            v: = and(mload(add(signature, 65)), 0xff)
        }
        require(v == 27 || v == 28);
    }
}