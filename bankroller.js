var openkey;
var socket;

var Casino = new CasinoJS();
var lightwallet = Casino.Account.lightWallet

channelAddress = "0xe56bcdc8bd4aa41a559bd62c7267a9289880fd80"

50, 70, 4, 27, "0x5132ad9fa6df2eeed68646783c41a59dc65f18f0617a66426f3b6060ff9a6c21", "0x5dce069cd268afbb428fd3b752b5504a48fecd29fcc9f77929a6b8806d4f3c13"

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

    socket.onmessage = function (event) {
        var msg = JSON.parse(event.data)
        if (msg.for == openkey) {
            switch (msg.command) {
                case "open":
                    openChannel(msg);
                    break;
                case "update":
                    updateChannel(msg);
                    break;
                case "close":
                    closeChannel(msg);
                    break;
            }
        }
    };
})()

function openChannel(msg) {
    channel = JSON.parse(msg.channel);
    var vrs = split(msg.sign);
    console.log("sign:", msg)
    signs[channel.nonce] = vrs;
    var args = [channel.player, +channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, +channel.nonce, +channel.time, +vrs.v, vrs.r, vrs.s]

    console.log("args:", args);
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
            options.to = channelAddress;
            options.gasPrice = "0x737be7600"; //web3.toHex('31000000000');
            options.gasLimit = "0x927c0"; //web3.toHex('600000');
            ks.keyFromPassword("password", function (err, pwDerivedKey) {
                console.log(err);
                var registerTx = lightwallet.txutils.functionTx(channelABI, 'open', args, options)
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
                        socket.send(
                            JSON.stringify({
                                from: channel.bankroll,
                                for: channel.player,
                                command: "answer",
                                channel: JSON.stringify(channel),
                                sign: d.result,
                            }));
                    }
                })
            })
        }
    })
    console.log("im open channel!")
    addRow();
}

function updateChannel(msg) {
    channel = JSON.parse(msg.channel);
    var vrs = split(msg.sign);
    signs[channel.nonce] = vrs;
    console.log("Im update channel!")
    var hash = "0x" + Casino.ABI.soliditySHA3(["uint", "uint", "uint"], [+channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, +channel.nonce]).toString('hex')
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        var s = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, hash, openkey));
        socket.send(
            JSON.stringify({
                from: channel.bankroll,
                for: channel.player,
                command: "answer",
                channel: JSON.stringify(channel),
                sign: s,
            }));
    })
    console.log("UPDATE");
    addRow();
}

function closeChannel(msg) {
    channel = JSON.parse(msg.channel);
    var vrs = split(msg.sign);
    console.log("sign:", msg)
    signs[channel.nonce] = vrs;
    var args = [+channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, 0, +vrs.v, vrs.r, vrs.s]
    console.log("Im close channel!")
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
            options.to = channelAddress;
            options.gasPrice = "0x737be7600"; //web3.toHex('31000000000');
            options.gasLimit = "0x927c0"; //web3.toHex('600000');
            ks.keyFromPassword("password", function (err, pwDerivedKey) {
                console.log(err);
                var registerTx = lightwallet.txutils.functionTx(channelABI, 'closeByConsent', args, options)
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
                        socket.send(
                            JSON.stringify({
                                from: channel.bankroll,
                                for: channel.player,
                                command: "answer",
                                channel: JSON.stringify(channel),
                                sign: d.result,
                            }));
                    }
                })
            })
        }
    })
    addRow();
}

function sendMsg(chan, command) {
    console.log("msg send", command)
    JSON.stringify(chan);
    // ws.send(
    //     JSON.stringify({
    //         from: openkey,
    //         for: chan.bankroll,
    //         command: command,
    //         channel: JSON.stringify(chan),
    //         sign: sign(chan),
    //     }));
}

function addRow() {
    $("#table").prepend([
        '<tr id=' + channel.nonce + ' class="warning">',
        '<th>' + channel.nonce + '</th>',
        '<td >' + channel.player + '</td>',
        '<td>' + channel.playerBalance + '</td>',
        '<td>' + channel.bankrollBalance + '</td>',
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

function split(m) {
    var vrs = {
        r: m.slice(0, 66),
        s: "0x" + m.slice(66, 130),
        v: hexToNum(m.slice(130, 132))
    }
    return vrs;
}

function sendOpenTx(sign) {}

function approve() {
    req("eth_call", [{
        "to": platform.tokenContract,
        "data": "0xdd62ed3e" + pad(ks.getAddresses(), 64) + pad(channelAddress.substr(2), 64)
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
                var args = [channelAddress, 9999999999999];
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

// "0x47cae14fdb7974faa631d3fa5d8a17e4bb8224cf",10,10,0,123,27,"0x3a8a9441a7cd864860f929c9085de465c7c146aa97ed56be5a43951dc8fe3444","0x2eade1dc003c70a6d74a2111a373aebaf6f4c336377f620572b5c0383a8f43d5"