var openkey;
var socket;

var platform = {
    referralContract: "0xe195eed0e77b48146aa246dadf987d2504ac88cb",
    tokenContract: "0x95a48dca999c89e4e284930d9b9af973a7481287",
    addressOperator: "0x6506e2D72910050554D0C47500087c485DAA9689",
    node: "https://ropsten.infura.io/JCnK5ifEPH9qcQkX0Ahl"
};

var channel = {
    id: "",
    parnter: "",
    player: 0,
    bankroll: 0,
    time: 0,
    i: 0,
}

var secrets = new Array();
var signs = new Array();


web3 = new Web3(new Web3.providers.HttpProvider(platform.node));

function create() {
    if (localStorage.getItem("ks")) {
        ks = lightwallet.keystore.deserialize(localStorage.getItem("ks"));
        console.log('!')
    } else {
        lightwallet.keystore.createVault({
            password: "password",
        }, function (err, ks) {
            localStorage.setItem("ks", ks.serialize());
        })
        ks.keyFromPassword("password", function (err, pwDerivedKey) {
            if (err) throw err;
            ks.generateNewAddress(pwDerivedKey, 1);
        })
    };
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
        switch (msg.type) {
            case "open":
                sendTx("open");
                break;
            case "update":
                sendTx("update");
                break;
            case "close":
                sendTx("close");
                break;
        }

        var res = confirm(msg.from + " запрашивает открытие канала")
        if (res) {
            //сравнение параметров и отправка в блокчейн
        }
    }

};
};

socket.onerror = function (error) {
    console.log("Ошибка " + error.message);
};


function openChannel() {
    var signHASH;

    channel.id = web3.sha3(Math.random() + ""); //RANDOM CHANNEL ID
    channel.parnter = $('#partner').val(); //openkey of partner
    channel.player = $('#deposit').val();
    channel.bankroll = $('#deposit').val();
    channel.time = $('#time').val();
    var secret = web3.sha3("secret_0"); //RANDOM SECRET
    secrets[channel.i] = "secret_0";
    var msgHash = web3.sha3("0x42"); //secret for open's transaction
    // var msgHash = SoliditySHA3(channel.id, channel.parnter, channel.player, channel.time, secrets[i]); //TODO SOLIDITY SHA3 
    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        console.log(err)
        signHASH = lightwallet.signing.signMsgHash(ks, pwDerivedKey, msgHash, openkey);
    })

    $('#opens').hide();
    $('#channelInfo').show();
    $('h4#deposit').html("deposit (YOU/PARTNER): " + channel.player + " BET / " + channel.bankroll + " BET")

    socket.send(
        JSON.stringify({
            from: openkey,
            for: channel.parnter,
            type: "open",
            channel: JSON.stringify(channel),
            message: signHASH
        }));
    //SEND SIGN HASH TO PARTNER FOR OPEN CHANNEL (USING ws, webRTC, whisper)
}

function update() {
    channel.i++;
    var secret = web3.sha3("secret_" + i); //RANDOM SECRET
    secrets[channel.i] = "secret_" + i;
    channel.player = $('#send').val();
    channel.bankroll = $('#deposit').val();
    channel.time--;
    var msgHash = web3.sha3("0x42");
    //var msgHash = SoliditySHA3(channel.id, channel.parnter, channel.player, channel.time, secrets[i]);

    ks.keyFromPassword("password", function (err, pwDerivedKey) {
        signHASH = lightwallet.signing.signMsgHash(ks, pwDerivedKey, msgHash, openkey);
    })

    socket.send(
        JSON.stringify({
            from: openkey,
            for: channel.parnter,
            command: "update",
            channel: JSON.stringify(channel),
            message: signHASH
        }));
    //SEND SIGN HASH TO PARTNER FOR UPDATE CHANNEL (USING ws, webRTC, whisper)
}

function closed() {
    
}

function approve() {
    addressContract = "0x6506e2D72910050554D0C47500087c485DAA9689" //channel manager 
    approveValue = +$('input#approveValue').val();
    console.log(approveValue)
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
                var args = [addressContract, approveValue];
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


    $('#opens').show();
    $('#approve').hide();
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

function sendTx(mes){
    console.log(mes)
}




