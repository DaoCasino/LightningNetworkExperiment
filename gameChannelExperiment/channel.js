var openkey;
var socket;
managerContract = "0xc2fd53d5951cf2c385c7ba2f201b9cc3725e0849"

var platform = {
    referralContract: "0xe195eed0e77b48146aa246dadf987d2504ac88cb",
    tokenContract: "0x95a48dca999c89e4e284930d9b9af973a7481287",
    addressOperator: "0x6506e2D72910050554D0C47500087c485DAA9689",
    node: "https://ropsten.infura.io/JCnK5ifEPH9qcQkX0Ahl"
};

var channel = {
    id: "",
    address: "",
    partner: "",
    playerBet: 0,
    bankrollBet: 0,
    time: 0,
    i: 0,
}

var secrets = new Array();
var signs = new Array();


web3 = new Web3(new Web3.providers.HttpProvider(platform.node));

(function() {
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
        $('#openkey').html(openkey)
        $('button.create').hide();
        $('#info').show();
        $('#channel').show();

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

    socket.onmessage = function (event) {
        console.log(event.data)
        var msg = JSON.parse(event.data)
        if (msg.for == openkey) {
            console.log(msg.command)
            switch (msg.command) {
                case "open":
                    ok(msg.from + " Requests opening channel", function (d) {
                        if (d) {
                            sendTx("open", msg.channel)
                        }
                    })
                    break;
                case "update":
                    ok(msg.from + " Requests update channel", function (d) {
                        if (d) {
                            sendTx("update", msg.channel)
                        }
                    })
                    break;
                case "close":
                    ok(msg.from + " Requests close channel", function (d) {
                        if (d) {
                            sendTx("close", msg.channel)
                        }
                    })
                    break;
            }


        }

    };
    socket.onerror = function (error) {
        console.log("Ошибка " + error.message);
    };

})()

function ok(string, callback) {
    console.log("OK")
    $('#msg').show();
    $('#msgtext').html(string);
    $('#msgbtn').click(function () {
        console.log("OK")
        callback(true)
        $('#msg').hide()
    })
}


function openChannel() {

    var signHASH;
    channel.address = openkey;
    channel.id = web3.sha3(Math.random() + ""); //RANDOM CHANNEL ID
    channel.partner = $('#partner').val(); //openkey of partner
    channel.playerBet = $('#deposit').val();
    channel.bankrollBet = $('#deposit').val();
    channel.time = $('#time').val();
    var secret = web3.sha3("secret_0"); //RANDOM SECRET
    secrets[channel.i] = "secret_0";
    msgHash = web3.sha3(channel.id, channel.partner, channel.player, channel.time, secrets[channel.i]); //secret for open's transaction
    // var msgHash = SoliditySHA3(channel.id, channel.partner, channel.player, channel.time, secrets[i]); //TODO SOLIDITY SHA3 
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        channel.sign = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, msgHash, openkey))
        signHASH = channel.sign;
        console.log("s", channel.sign)

        socket.send(
            JSON.stringify({
                from: openkey,
                for: channel.partner,
                command: "open",
                channel: JSON.stringify(channel),
                message: signHASH
            }));
    })

    $('#opens').hide();
    $('#channelInfo').show();
    $('#bal').html("deposit (YOU/PARTNER): " + channel.playerBet / 10 ** 8 + " BET / " + channel.bankrollBet / 10 ** 8 + " BET")


    //SEND SIGN HASH TO PARTNER FOR OPEN CHANNEL (USING ws, webRTC, whisper)
}

function update() {
    channel.i++;
    var secret = web3.sha3("secret_" + channel.i); //RANDOM SECRET
    secrets[channel.i] = "secret_" + channel.i;
    channel.playerBet = $('#updatePlayer').val();
    channel.bankrollBet = $('#updateBankroll').val();
    channel.time--;
    msgHash = web3.sha3(channel.id, channel.partner, channel.player, channel.time, secrets[channel.i]);
    //var msgHash = SoliditySHA3(channel.id, channel.partner, channel.player, channel.time, secrets[i]);
    var signHASH;
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        channel.sign = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, msgHash, openkey))
        signHASH = channel.sign;
        socket.send(
            JSON.stringify({
                from: openkey,
                for: channel.partner,
                command: "update",
                channel: JSON.stringify(channel),
                message: signHASH
            }));
    })
    $('#bal').html("deposit (YOU/PARTNER): " + channel.playerBet / 10 ** 8 + " BET / " + channel.bankrollBet / 10 ** 8 + " BET")
    //SEND SIGN HASH TO PARTNER FOR UPDATE CHANNEL (USING ws, webRTC, whisper)
}

function close() {
    channel.i++;
    var secret = web3.sha3("secret_" + channel.i); //RANDOM SECRET
    secrets[channel.i] = "secret_" + channel.i;
    channel.playerBet = $('#updatePlayer').val();
    channel.bankrollBet = $('#updateBankroll').val();
    channel.time--;
    msgHash = web3.sha3(channel.id, channel.partner, channel.player, channel.time, secrets[channel.i]);
    //var msgHash = SoliditySHA3(channel.id, channel.partner, channel.player, channel.time, secrets[i]);
    var signHASH;
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        channel.sign = lightwallet.signing.concatSig(lightwallet.signing.signMsgHash(ks, pwDerivedKey, msgHash, openkey))
        signHASH = channel.sign;
        socket.send(
            JSON.stringify({
                from: openkey,
                for: channel.partner,
                command: "close",
                channel: JSON.stringify(channel),
                message: signHASH
            }));
    })
    $('#bal').html("deposit (YOU/PARTNER): " + channel.playerBet / 10 ** 8 + " BET / " + channel.bankrollBet / 10 ** 8 + " BET")
    //SEND SIGN HASH TO PARTNER FOR UPDATE CHANNEL (USING ws, webRTC, whisper)
}

function approve() {
    //channel manager 
    var approveValue = +$('input#approveValue').val();
    console.log("value:", approveValue)
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
                var args = [managerContract, approveValue];
                var registerTx = lightwallet.txutils.functionTx(erc20abi, 'approve', args, options)
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
                        if (d.result == undefined) {
                            //approve();
                        }
                    }
                })
            })
        }
    })
    $('#approve').html("please wait")
    var t = setInterval(function () {
        req("eth_call", [{
            "to": platform.tokenContract,
            "data": "0xdd62ed3e" + pad(ks.getAddresses(), 64) + pad(managerContract.substr(2), 64)
        }, "latest"], function (d) {
            console.log(hexToNum(d))
            if (hexToNum(d) > 0) {
                $('#opens').show();
                $('#approve').hide();
                clearInterval(t);
            }
        })
    }, 3000)


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

function sendTx(command, msgchannel) {
    var callData;
    
    d = JSON.parse(msgchannel);
    d.partner = d.address;
    d.address = openkey;
    channel = d;
    console.log(d)

    $('#opens').hide();
    $('#channelInfo').show();
    $('#bal').html("deposit (YOU/PARTNER): " + channel.playerBet / 10 ** 8 + " BET / " + channel.bankrollBet / 10 ** 8 + " BET")
   
    switch (command) {
        case "open":
            callData = "open";
            args = [d.id, d.address, d.playerBet, d.time, d.sign];
            break;
        case "update":
            callData = "update";
            args = [d.id, d.sign, d.playerBet, d.bankrollBet, d.time];
            break;
        case "close":
            callData = "closeByConsent";
            args = [d.id, d.sign, d.playerBet, d.bankrollBet, d.time];
            break;
    }

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
                var registerTx = lightwallet.txutils.functionTx(channelABI, callData, args, options)
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