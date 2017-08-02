pragma solidity ^ 0.4 .13;

contract ERC20 {
    function transfer(address _to, uint256 _value);
    function transferFrom(address _from, address _to, uint256 _value) returns(bool success);
}

contract PayChannel {

    struct Channel {
        address player;
        address bankroller;
        uint playerDeposit;
        uint bankrollDeposit;
        uint nonce;
        uint endTime;
        bool open;
    }

    Channel public c;

    ERC20 token = ERC20(0x95a48dca999c89e4e284930d9b9af973a7481287);

    function open(address player, uint playerDeposit, uint bankrollDeposit, uint nonce, uint time, uint8 v, bytes32 r, bytes32 s) {
        var partner = ecrecover(sha3(player, playerDeposit, bankrollDeposit, nonce, time), v, r, s);
        assert(partner == player);
        assert(token.transferFrom(player, this, playerDeposit));
        assert(token.transferFrom(msg.sender, this, bankrollDeposit));
        c = Channel(player, msg.sender, playerDeposit, bankrollDeposit, nonce, now + time, true);
    }

    function update(uint playerDeposit, uint bankrollDeposit, uint nonce, uint8 v, bytes32 r, bytes32 s) {
        assert(c.open);
        var partner = ecrecover(sha3(playerDeposit, bankrollDeposit, nonce), v, r, s);
        assert(nonce > c.nonce);
        assert(partner != msg.sender && partner == c.player || partner == c.bankroller);
    }

    function closeByConsent(uint playerDeposit, uint bankrollDeposit, uint nonce, uint8 v, bytes32 r, bytes32 s) {
        assert(c.open);
        var partner = ecrecover(sha3(playerDeposit, bankrollDeposit, nonce), v, r, s);
        assert(partner != msg.sender && partner == c.player || partner == c.bankroller);
        assert(nonce == 0);
        token.transfer(c.player, playerDeposit);
        token.transfer(c.bankroller, bankrollDeposit);
    }

    function closeByTime() {
        assert(c.open);
        assert(now > c.endTime);
        token.transfer(c.player, c.playerDeposit);
        token.transfer(c.bankroller, c.bankrollDeposit);
    }
}