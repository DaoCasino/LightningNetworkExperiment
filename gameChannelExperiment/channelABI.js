var channelABI = [{
    "constant": false,
    "inputs": [{
        "name": "player",
        "type": "address"
    }, {
        "name": "playerDeposit",
        "type": "uint256"
    }, {
        "name": "bankrollDeposit",
        "type": "uint256"
    }, {
        "name": "nonce",
        "type": "uint256"
    }, {
        "name": "time",
        "type": "uint256"
    }, {
        "name": "v",
        "type": "uint8"
    }, {
        "name": "r",
        "type": "bytes32"
    }, {
        "name": "s",
        "type": "bytes32"
    }],
    "name": "open",
    "outputs": [],
    "payable": false,
    "type": "function"
}, {
    "constant": false,
    "inputs": [{
        "name": "playerDeposit",
        "type": "uint256"
    }, {
        "name": "bankrollDeposit",
        "type": "uint256"
    }, {
        "name": "nonce",
        "type": "uint256"
    }, {
        "name": "v",
        "type": "uint8"
    }, {
        "name": "r",
        "type": "bytes32"
    }, {
        "name": "s",
        "type": "bytes32"
    }],
    "name": "update",
    "outputs": [],
    "payable": false,
    "type": "function"
}, {
    "constant": false,
    "inputs": [{
        "name": "playerDeposit",
        "type": "uint256"
    }, {
        "name": "bankrollDeposit",
        "type": "uint256"
    }, {
        "name": "nonce",
        "type": "uint256"
    }, {
        "name": "v",
        "type": "uint8"
    }, {
        "name": "r",
        "type": "bytes32"
    }, {
        "name": "s",
        "type": "bytes32"
    }],
    "name": "closeByConsent",
    "outputs": [],
    "payable": false,
    "type": "function"
}, {
    "constant": false,
    "inputs": [],
    "name": "closeByTime",
    "outputs": [],
    "payable": false,
    "type": "function"
}, {
    "constant": true,
    "inputs": [],
    "name": "c",
    "outputs": [{
        "name": "player",
        "type": "address"
    }, {
        "name": "bankroller",
        "type": "address"
    }, {
        "name": "playerDeposit",
        "type": "uint256"
    }, {
        "name": "bankrollDeposit",
        "type": "uint256"
    }, {
        "name": "nonce",
        "type": "uint256"
    }, {
        "name": "endTime",
        "type": "uint256"
    }, {
        "name": "open",
        "type": "bool"
    }],
    "payable": false,
    "type": "function"
}]