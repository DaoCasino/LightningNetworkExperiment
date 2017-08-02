var openkey;
var socket;
var Casino = new CasinoJS();
var lightwallet = Casino.Account.lightWallet


managerContract = "0xc2fd53d5951cf2c385c7ba2f201b9cc3725e0849"

var platform = {
    referralContract: "0xe195eed0e77b48146aa246dadf987d2504ac88cb",
    tokenContract: "0x95a48dca999c89e4e284930d9b9af973a7481287",
    addressOperator: "0x6506e2D72910050554D0C47500087c485DAA9689",
    node: "https://ropsten.infura.io/JCnK5ifEPH9qcQkX0Ahl"
};

var channel = {
    player: "",
    bankroll: "",
    playerBalance: 0,
    bankrollBalance: 0,
    nonce: 0,
    time: 0
}

var signs = new Array();
var txState = new Array();
var tx = new Array();

web3 = new Web3(new Web3.providers.HttpProvider(platform.node));

(function () {

    if (localStorage.getItem("ks")) {
        ks = lightwallet.keystore.deserialize(localStorage.getItem("ks"));
        console.log('!')
    } else {
        lightwallet.keystore.createVault({
            password: "password",
        }, function (err, ks) {
            localStorage.setItem("ks", ks.serialize());
        })
    };
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        if (err) throw err;
        ks.generateNewAddress(pwDerivedKey, 1);
        openkey = "0x" + ks.getAddresses();
        $('#openkey').html("openkey: " + openkey)

        req("eth_getBalance", ["0x" + ks.getAddresses(), "latest"], function (d) {
            $("#balance").html("ETH balance: " + (d / 10 ** 18).toFixed(3) + " ETH");
        })

        req("eth_call", [{
            "to": platform.tokenContract,
            "data": "0x70a08231" + pad(ks.getAddresses(), 64)
        }, "latest"], function (d) {
            $("#token").html("BET balance:" + (d / 10 ** 8) + " BET");
        })
    })

    socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = function () {
        console.log("Соединение установлено.");
    };

    socket.onclose = function (event) {
        if (event.wasClean) {
            console.log('Соединение закрыто чисто');
        } else {
            console.log('Обрыв соединения'); // например, "убит" процесс сервера
        }
        console.log('Код: ' + event.code + ' причина: ' + event.reason);
        socket = new WebSocket("ws://localhost:8000/ws");
    };

    socket.onerror = function (error) {
        console.log("Ошибка " + error.message);
    };


})()

function openChannel() {
    channel.player = openkey;
    channel.bankroll = $('#bankrollAddress').val()
    channel.playerBalance = $('#playerBalance').val()
    channel.bankrollBalance = $('#bankrollBalance').val()
    channel.nonce = 0;
    channel.time = $('#time').val();
    txState[channel.nonce] = 'pending';
    $('#opened').show();
    $('#opens').hide();
    sendMsg(channel, "open")
    addRow();
}

function updateChannel() {
    channel.playerBalance = $('#playerUpdate').val()
    channel.bankrollBalance = $('#bankrollUpdate').val()
    channel.nonce++;
    txState[channel.nonce] = 'NO';
    sendMsg(channel, "update");
    addRow();
}

function closeChannel() {

    sendTx();
    sendMsg(channel, "close")
}

function sendMsg(chan, command) {
    console.log("msg send", command)
    JSON.stringify(chan);
    var s;
    sign(chan, function (result) {
        s = result;
        console.log(s);
        socket.send(
            JSON.stringify({
                from: openkey,
                for: chan.bankroll,
                command: command,
                channel: JSON.stringify(chan),
                sign: s,
            }));
    })

}

function addRow() {
    $("#table").prepend([
        '<tr id=' + channel.nonce + '>',
        '<th>' + channel.nonce + '</th>',
        '<td >' + channel.bankroll + '</td>',
        '<td>' + channel.playerBalance + '</td>',
        '<td>' + channel.bankrollBalance + '</td>',
        '<td>' + txState[channel.nonce] + '</td>',
        '</tr>'
    ].join(''));
}

function req(method, params, callback) {
    $.ajax({
        type: "POST",
        url: "https://ropsten.infura.io/JCnK5ifEPH9qcQkX0Ahl",
        dataType: 'json',
        async: true,
        data: JSON.stringify({
            "id": 0,
            "jsonrpc": '2.0',
            "method": method,
            "params": params,
        }),
        success: function (d) {
            callback(d.result)
        }
    });
}

function sendTx() {

}

function pad(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
};

function toFixed(value, precision) {
    precision = Math.pow(10, precision);
    return Math.ceil(value * precision) / precision;
};

function numToHex(num) {
    return num.toString(16);
};

function hexToNum(str) {
    return parseInt(str, 16);
};


function sign(c, callback) {
    var hash = "0x" + Casino.ABI.soliditySHA3(["address", "uint", "uint", "uint","uint"], [c.player, c.playerBalance, c.bankrollBalance, c.nonce, c.time]).toString('hex')
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        callback(lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, hash, openkey)))
    })
}

function sendTx(type, args) {
    $.ajax({
        type: "POST",
        url: platform.node,
        dataType: 'json',
        async: false,
        data: JSON.stringify({
            "id": 0,
            "jsonrpc": '2.0',
            "method": "eth_getTransactionCount",
            "params": [openkey, "latest"]
        }),
        success: function (d) {
            console.log("get nonce action " + d.result);
            var options = {};
            options.nonce = d.result;
            options.to = managerContract;
            options.gasPrice = "0x737be7600"; //web3.toHex('31000000000');
            options.gasLimit = "0x927c0"; //web3.toHex('600000');
            ks.keyFromPassword("password", function (err, pwDerivedKey) {
                console.log(err);
                var registerTx = lightwallet.txutils.functionTx(channelABI, type, args, options)
                var signedTx = lightwallet.signing.signTx(ks, pwDerivedKey, registerTx, openkey)
                console.log("lightWallet sign:", signedTx)
                $.ajax({
                    type: "POST",
                    url: platform.node,
                    dataType: 'json',
                    async: false,
                    data: JSON.stringify({
                        "id": 0,
                        "jsonrpc": '2.0',
                        "method": "eth_sendRawTransaction",
                        "params": ["0x" + signedTx]
                    }),
                    success: function (d) {
                        console.log("The transaction was signed:", d.result);
                    }
                })
            })
        }
    })
}

function approve() {
    req("eth_call", [{
        "to": platform.tokenContract,
        "data": "0xdd62ed3e" + pad(ks.getAddresses(), 64) + pad("e56bcdc8bd4aa41a559bd62c7267a9289880fd80", 64)
    }, "latest"], function (d) {
        console.log(hexToNum(d))
        if (numToHex(d) > 0) {
            return;
        }
    })
    $.ajax({
        type: "POST",
        url: platform.node,
        dataType: 'json',
        async: false,
        data: JSON.stringify({
            "id": 0,
            "jsonrpc": '2.0',
            "method": "eth_getTransactionCount",
            "params": [openkey, "latest"]
        }),
        success: function (d) {
            console.log("get nonce action " + d.result);
            var options = {};
            options.nonce = d.result;
            options.to = platform.tokenContract;
            options.gasPrice = "0x737be7600"; //web3.toHex('31000000000');
            options.gasLimit = "0x927c0"; //web3.toHex('600000');
            ks.keyFromPassword("password", function (err, pwDerivedKey) {
                console.log(err);
                var args = ["0xe56bcdc8bd4aa41a559bd62c7267a9289880fd80", 9999999999999];
                var registerTx = lightwallet.txutils.functionTx(erc20abi, 'approve', args, options)
                var signedTx = lightwallet.signing.signTx(ks, pwDerivedKey, registerTx, openkey)
              
                $.ajax({
                    type: "POST",
                    url: platform.node,
                    dataType: 'json',
                    async: false,
                    data: JSON.stringify({
                        "id": 0,
                        "jsonrpc": '2.0',
                        "method": "eth_sendRawTransaction",
                        "params": ["0x" + signedTx]
                    }),
                    success: function (d) {
                        console.log("The transaction was signed:", d.result);
                        if (d.result == undefined) {
                            //approve();
                        }
                    }
                })
            })
        }
    })
}