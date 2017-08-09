var openkey;
var socket;

var Casino = new CasinoJS();
var lightwallet = Casino.Account.lightWallet

channelAddress = "0xe56bcdc8bd4aa41a559bd62c7267a9289880fd80"


//managerContract = "0xc2fd53d5951cf2c385c7ba2f201b9cc3725e0849"

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
        ks.keyFromPassword("password", function (err, pwDerivedKey) {
            if (err) throw err;
            ks.generateNewAddress(pwDerivedKey, 1);
            openkey = "0x" + ks.getAddresses();
            $('#openkey').html("openkey: " + openkey)
        })
    } else {
        lightwallet.keystore.createVault({
            password: "password",
        }, function (err, kstore) {
            localStorage.setItem("ks", kstore.serialize());
            ks = kstore;
            kstore.keyFromPassword("password", function (err, pwDerivedKey) {
                if (err) throw err;
                ks.generateNewAddress(pwDerivedKey, 1);
                openkey = "0x" + ks.getAddresses();
                $('#openkey').html("openkey: " + openkey)
            })
        })
    };

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
                    msgOpen(msg);
                    break;
                case "update":
                    msgUdate(msg);
                    break;
                case "close":
                    msgClose(msg);
                    break;
                case "answer":
                    console.log("ANSWER")
                    answer(msg);
                    break;
            }
        }
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

    JSON.stringify(channel);
    var hash = "0x" + Casino.ABI.soliditySHA3(["address", "uint", "uint", "uint", "uint"], [channel.player, +channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, +channel.nonce, +channel.time]).toString('hex')
    ks.keyFromPassword("password", function (err, pwDerivedKey) {

        console.log(err)
        var s = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, hash, openkey));
        socket.send(
            JSON.stringify({
                from: channel.player,
                for: channel.bankroll,
                command: "open",
                channel: JSON.stringify(channel),
                sign: s,
            }));
    })
    addRow();
}

function updateChannel() {
    channel.playerBalance = $('#playerUpdate').val()
    channel.bankrollBalance = $('#bankrollUpdate').val()
    channel.nonce++;
    txState[channel.nonce] = 'NO';
    JSON.stringify(channel);
    var hash = "0x" + Casino.ABI.soliditySHA3(["uint", "uint", "uint", ], [+channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, +channel.nonce]).toString('hex')
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        var s = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, hash, openkey));
        socket.send(
            JSON.stringify({
                from: openkey,
                for: channel.bankroll,
                command: "update",
                channel: JSON.stringify(channel),
                sign: s,
            }));
    })
    addRow();
}

function closeChannel() {
    // channel.playerBalance = $('#playerUpdate').val()
    // channel.bankrollBalance = $('#bankrollUpdate').val()
    channel.nonce = 0;
    txState[channel.nonce] = 'NO';
    JSON.stringify(channel);
    var hash = "0x" + Casino.ABI.soliditySHA3(["uint", "uint", "uint"], [+channel.playerBalance * 10 ** 8, +channel.bankrollBalance * 10 ** 8, 0]).toString('hex')
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        var s = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, hash, openkey));
        socket.send(
            JSON.stringify({
                from: openkey,
                for: channel.bankroll,
                command: "close",
                channel: JSON.stringify(channel),
                sign: s,
            }));
    })
    addRow();
}

function updateState() {

    var vrs = split(signs[channel.nonce]);
    var args = [+channel.playerBalance, +channel.bankrollBalance, +channel.nonce, +vrs.v, vrs.r, vrs.s]
    console.log(args);
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
                var registerTx = lightwallet.txutils.functionTx(channelABI, 'update', args, options)
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
                        console.log("save changes")
                    }
                })
            })
        }
    })
}



function answer(msg) {
    //TODO CHECK INFO
    var state = JSON.parse(msg.channel);
    signs[state.nonce] = msg.sign;
    $('tr#' + state.nonce).removeClass().addClass('success')
    console.log(state);
    console.log(msg.command)
    if (state.nonce == 0) {
        $('#tx').html('<h3><a target="_blank" href="https://ropsten.etherscan.io/tx/' + msg.sign + '">' + 'Tx: ' + msg.sign.slice(0, 15) + '...</a></h3>');
    }
}


function addRow() {
    $("#table").prepend([
        '<tr id=' + channel.nonce + ' class="warning">',
        '<th>' + channel.nonce + '</th>',
        '<td >' + channel.bankroll + '</td>',
        '<td>' + channel.playerBalance + '</td>',
        '<td>' + channel.bankrollBalance + '</td>',
        '</tr>'
    ].join(''));
}

function split(m) {
    var vrs = {
        r: m.slice(0, 66),
        s: "0x" + m.slice(66, 130),
        v: hexToNum(m.slice(130, 132))
    }
    return vrs;
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

var t = setInterval(function () {
    req("eth_getBalance", ["0x" + ks.getAddresses(), "latest"], function (d) {
        $("#balance").html("ETH balance: " + (d / 10 ** 18).toFixed(3) + " ETH");
    })

    req("eth_call", [{
        "to": platform.tokenContract,
        "data": "0x70a08231" + pad(ks.getAddresses(), 64)
    }, "latest"], function (d) {
        $("#token").html("BET balance:" + (d / 10 ** 8) + " BET");
    })
}, 3000)