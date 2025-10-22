
var express = require("express");
var https = require("https");
const fs = require("fs");
require("dotenv").config();


const bodyParser = require('body-parser');
express = express();

express.use(bodyParser.urlencoded({ extended: true }));

try {

    var privateKey = fs.readFileSync('/etc/letsencrypt/live/citymedia.synology.me/privkey.pem', 'utf8');
    var certificate = fs.readFileSync('/etc/letsencrypt/live/citymedia.synology.me/cert.pem', 'utf8');

    var credentials = { key: privateKey, cert: certificate };
    var httpsServer = https.createServer(credentials, express);
    httpsServer = httpsServer.listen(40006, '0.0.0.0', () => {
        console.log(`Ct coin server https app listening on port 40006!`)

    });
    var ioHttps = createHttpsServer(httpsServer);
} catch (error) {
    console.log(error);
}

var authorizationString = "Bearer socketServer_5fc222d8dc5ba0f1f54faf47744";
const erpUrl = process.env.ERPURL;


var server = express.listen(40005, '0.0.0.0', () => {
    console.log(`Ct coin server http app listening on port 40005!`)

});





var machines = new Map();

// function findRelatedPi(socket) {
//     var piSocket = pis.find((o) => {
//         return io.sockets.sockets.get(o).room == socket.room;
//     });
//     piSocket = io.sockets.sockets.get(piSocket);
//     return piSocket;
// }

var io = require('socket.io')(server, {
    cors: {
        origin: ["http://192.168.1.108", "http://nubes.com", /(http|https)\:\/\/citymedia.synology.me(\:8080)?/],
        methods: ["GET", "POST"]
    }
});
SetupIo(io, ioHttps);


function createHttpsServer(httpsServer) {

    var ioHttps = require('socket.io')(httpsServer, {
        cors: {
            origin: ["http://192.168.1.108", "http://nubes.com", /(http|https)\:\/\/citymedia.synology.me(\:8080)?/],
            methods: ["GET", "POST"]
        }
    });

    SetupIo(ioHttps);

    return ioHttps;

}


function SetupIo(io, ioHttps = undefined) {

    // server-side
    io.use((socket, next) => {

        //switch by client type (PI or a user) based on logon
        if (socket.handshake.auth.token == "abc") {
            socket.type = "user";
        } else {
            socket.type = "pi";
        }

        if (socket.request._query.room) {
            socket.room = socket.request._query.room;
        }

        next();
    });

    async function setupMachineEvents(room, socket) {

        //jelezzük a kapcsolódás tényét
        fetch(`${erpUrl}/Control/CityMedia/Telemetry/Telemetry/PiConnect/`,
            {
                method: "POST"
                , headers: {
                    Authorization: authorizationString
                    , "Content-Type": "application/json"
                }
                , timeout: 40000
                , body: JSON.stringify({ serialNumber: room, ipAddress: socket.handshake.address })
            }
        ).catch(error => {
            console.log(error);
        });

        socket.to(room).emit("piconnected", { room: room, data: { connected: true } });
        if (ioHttps) {
            ioHttps.sockets.to(room).emit("piconnected", { room: room, data: { connected: true } });
        }

        //további eventek már be vannak állítva
        if (socket.machineEventsSet) return; // már be van állítva
        socket.machineEventsSet = true;

        // A gépet eltároljuk
        machines.set(room.toString(), socket);
        // szobába csatlakoztatjuk 
        socket.join(room);

        //notify Telemetry about machine's connect


        socket.on("testPiEvent", (data) => {
            socket.to(room).emit("testPiEvent", { room: room, data: data });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("testPiEvent", { room: room, data: data });
            }
        });

        socket.on("infoChange", (data) => {
            socket.to(room).emit("infoChange", { room: room, data: data });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("infoChange", { room: room, data: data });
            }
        });

        socket.on("coinCount", (data) => {
            socket.to(room).emit("coinCount", { room: room, data: data });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("coinCount", data);
            }
        });

        socket.on("updateProgress", (data) => {
            socket.to(room).emit("updateProgress", { room: room, data: data });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("updateProgress", data);
            }
        });

        socket.on("rawError", (data) => {
            socket.to(room).emit("rawError", { room: room, data: data });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("rawError", data);
            }
        });




        socket.on('disconnect', function () {

            //notify Telemetry about pi's disconnect
            socket.to(room).emit("piconnected", { room: room, data: { connected: false } });
            if (ioHttps) {
                ioHttps.sockets.to(room).emit("piconnected",  { room: room, data: { connected: false } });
            }

            //notify Telemetry about machine's connect
            fetch(`${erpUrl}/Control/CityMedia/Telemetry/Telemetry/PiDisconnect/`,
                {
                    method: "POST"
                    , headers: {
                        Authorization: authorizationString
                        , "Content-Type": "application/json"
                    }
                    , timeout: 40000
                    , body: JSON.stringify({ serialNumber: room })
                }
            ).catch(error => {
                console.log(error);
            });

        });


    }

    async function setupClientEvents(roomParam, socket) {

        //jelezzük a kapcsolódás tényét
        //find pi connected to this room
        var piSocket = machines.get(roomParam);
        var piConnected = piSocket !== undefined && piSocket.connected;
        
        socket.emit("piconnected", { room: roomParam, data: { connected: piConnected } });
        if (ioHttps) {
            ioHttps.sockets.to(roomParam).emit("piconnected", { room: roomParam, data: { connected: piConnected } });
        }


        //további eventek már be vannak állítva
        if (socket.clientEventsSet) return; // már be van állítva
        socket.clientEventsSet = true;



        socket.on("update", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && piSocket == null || !piSocket.connected) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("update", data, cb);
            }
        });
        socket.on("tossACoinToYourWitcher", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && piSocket == null || !piSocket.connected) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("tossACoinToYourWitcher", data, cb);
            }
        });

        socket.on("getInfo", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("getInfo", data, cb);
            }
        });

        socket.on("getErrors", ({ room, data }, cb) => {
            // if (!socket.rooms.has(room)) {
            //     console.warn(`Socket not in room ${room}, ignoring event`);
            //     return;
            // }
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("getErrors", data, cb);
            }
        });


        socket.on("deleteErrors", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("deleteErrors", data, cb);
            }
        });


        socket.on("emptyHopper", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("emptyHopper", data, cb);
            }
        });

        socket.on("fillUpHopper", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("fillUpHopper", data, cb);
            }
        });

        socket.on("updateFirmware", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("updateFirmware", data, cb);
            }
        });

        socket.on("restart", ({ room, data }, cb) => {
            // if (roomParam !== room) {
            //     return;
            // }
            var piSocket = machines.get(room);
            if (cb != null && (piSocket == null || !piSocket.connected)) {
                cb(null, { message: "Pi currently unavailable" });
            }
            if (piSocket != null && piSocket.connected) {

                piSocket.emit("restart", data, cb);
            }
        });


        socket.on('disconnect', function () {

            console.log("Disconnected " + socket.handshake.address);

        });
    }

    io.on('connection', function (socket) {// WebSocket Connection

        console.log("Connected " + socket.handshake.address);

        //legacy support
        if (socket.room) {
            socket.join(socket.room);
            if (socket.type === "pi") {
                setupMachineEvents(socket.room, socket);
            } else {
                setupClientEvents(socket.room, socket);
            }
        }

        // Csatlakozás szobába
        socket.on("joinRoom", ({ room, isMachine }) => {
            if(!room){
                return;
            }
            room = room ? room.toString() : null;
            socket.join(room);
            socket.room = room;
            if (isMachine) {
                setupMachineEvents(room, socket);

            } else {
                setupClientEvents(room, socket);
                
            }
        });






    });
}