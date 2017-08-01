pragma solidity ^ 0.4 .13;

contract ERC20 {
    function transfer(address _to, uint256 _value);

    function transferFrom(address _from, address _to, uint256 _value) returns(bool success);
}

contract PayChannel {

    ERC20 token = ERC20(0x95a48dca999c89e4e284930d9b9af973a7481287);

    event channel(address, address, string, uint, uint);

    enum state {
        open,
        close,
        finish
    }

    struct Channel {
        state statte;
        address player;
        address bankroll;

        uint startDate;
        uint channelTimeout;

        address closing_address;
        uint player_bet;
        uint bankroll_bet;
        bytes32 secret;
    }

    mapping(bytes32 => Channel) public channels;

    function open(bytes32 id, address partner, uint deposit, uint time, bytes32 secret, bytes sign) {
        var (r, s, v) = signatureSplit(sign);
        assert(partner == ecrecover(sha3(id, msg.sender, deposit, time, secret), v, r, s));
        assert(token.transferFrom(msg.sender, this, deposit));
        assert(token.transferFrom(partner, this, deposit));
        channels[id] = Channel({
            statte: state.open,
            player: msg.sender,
            bankroll: partner,
            startDate: now,
            channelTimeout: now + time * 1 minutes,
            closing_address: 0,
            player_bet: deposit,
            bankroll_bet: deposit,
            secret: secret
        });
        channel(msg.sender, partner, "open", deposit, deposit);
    }

    function update(bytes32 id, bytes sign, uint playerBet, uint bankrollBet, bytes32 secret, uint time) {
        var (r, s, v) = signatureSplit(sign);
        assert(msg.sender == channels[id].player || msg.sender == channels[id].bankroll);
        assert(msg.sender != ecrecover(sha3(id, playerBet, bankrollBet, secret, time), v, r, s));
        assert(time < channels[id].channelTimeout);
        channels[id].statte = state.close;
        channels[id].player_bet = playerBet;
        channels[id].bankroll_bet = bankrollBet;
        channels[id].secret = secret;
        channels[id].closing_address = msg.sender;
        channel(channels[id].player, channels[id].bankroll, "update", playerBet, bankrollBet);
    }


    function closeByConsent(bytes32 id, bytes sign, uint playerBet, uint bankrollBet, uint time) {
        assert(time == 0);
        var (r, s, v) = signatureSplit(sign);
        assert(msg.sender == channels[id].player || msg.sender == channels[id].bankroll);
        assert(msg.sender != ecrecover(sha3(id, playerBet, bankrollBet, time), v, r, s));
        assert(time < channels[id].channelTimeout);
        channels[id].statte = state.close;
        channels[id].player_bet = playerBet;
        channels[id].bankroll_bet = bankrollBet;
        channels[id].secret = 0;
        channels[id].closing_address = msg.sender;
        token.transfer(channels[id].player, channels[id].player_bet);
        token.transfer(channels[id].bankroll, channels[id].bankroll_bet);
        channel(channels[id].player, channels[id].bankroll, "closeByConsent", playerBet, bankrollBet);
    }

    function closeByTime(bytes32 id) {
        if (now > channels[id].channelTimeout + channels[id].startDate) {
            token.transfer(channels[id].player, channels[id].player_bet);
            token.transfer(channels[id].bankroll, channels[id].bankroll_bet);
            channels[id].statte = state.finish;
            channel(channels[id].player, channels[id].bankroll, "close", channels[id].player_bet, channels[id].bankroll_bet);
        }
    }


    // function closeBySecret(bytes32 id, uint secret){
    //     if (sha3(secret) == channels[id].secret) {
    //         token.transfer(msg.sender, channels[id].player_bet + channels[id].bankroll_bet);
    //         channels[id].statte = state.finish;
    //     } 
    // }

    function signatureSplit(bytes signature) internal returns(bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r: = mload(add(signature, 32))
            s: = mload(add(signature, 64))
            v: = and(mload(add(signature, 65)), 0xff)
        }
        require(v == 27 || v == 28);
    }

}