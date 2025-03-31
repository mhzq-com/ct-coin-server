
var express = require("express");
var https = require("https");
const fs = require("fs");

const WebRequest = require("@mhzq/mhzqframework").Web.Http.HttpRequest.HttpRequest;
const bodyParser = require('body-parser');
express = express();

express.use(bodyParser.urlencoded({ extended: true }));

try {

    var privateKey = fs.readFileSync('/etc/letsencrypt/live/citymedia.synology.me/privkey.pem', 'utf8');
    var certificate = fs.readFileSync('/etc/letsencrypt/live/citymedia.synology.me/cert.pem', 'utf8');

    var credentials = { key: privateKey, cert: certificate };
    var httpsServer = https.createServer(credentials, express);
    httpsServer = httpsServer.listen(40006, '0.0.0.0', () => {

    });
    var ioHttps = createHttpsServer(httpsServer);
} catch (error) {
    console.log(error);
}

var authorizationString = "Bearer socketServer_5fc222d8dc5ba0f1f54faf47744";
var service = new WebRequest("citymedia.synology.me", 8080);


var server = express.listen(40005, '0.0.0.0', () => {
    console.log(`Example app listening on port 40005!`)

    var cmd = null;


});





var pis = [];

function findRelatedPi(socket) {
    var piSocket = pis.find((o) => {
        return io.sockets.sockets.get(o).room == socket.room;
    });
    piSocket = io.sockets.sockets.get(piSocket);
    return piSocket;
}

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

    

    io.on('connection', function (socket) {// WebSocket Connection

        console.log("Connected " + socket.handshake.address);

        //@TODO each room for pi
        socket.join(socket.room);

        if (socket.type === "pi") {


            var serialNumber = socket.room;

            pis.push(socket.id);

            //notify Telemetry about pi's connect
            service.post({ path: "/api/Control/CityMedia/Telemetry/Telemetry/PiConnect", headers: { Authorization: authorizationString }, timeout: 40000 }, { serialNumber: serialNumber, ipAddress: socket.handshake.address }).then(data => {

            }).catch(error => {
                console.log(error);
            });

            socket.on("testPiEvent", (data) => {
                socket.to(socket.room).emit("testPiEvent", data);
                if(ioHttps){
                    ioHttps.sockets.to(socket.room).emit("testPiEvent", data);
                }
            });

            socket.on("infoChange", (data) => {
                socket.to(socket.room).emit("infoChange", data);
                if(ioHttps){
                    ioHttps.sockets.to(socket.room).emit("infoChange", data);
                }
            });

            socket.on("coinCount", (data) => {
                socket.to(socket.room).emit("coinCount", data);
                if(ioHttps){
                    ioHttps.sockets.to(socket.room).emit("coinCount", data);
                }
            });

            socket.on("rawError", (data) => {
                socket.to(socket.room).emit("rawError", data);
                if(ioHttps){
                    ioHttps.sockets.to(socket.room).emit("rawError", data);
                }
            });

            socket.to(socket.room).emit("piconnected", { connected: true });
            if(ioHttps){
                ioHttps.sockets.to(socket.room).emit("piconnected", { connected: true });
            }


            socket.on('disconnect', function () {

                //notify Telemetry about pi's disconnect
                socket.to(socket.room).emit("piconnected", { connected: false });
                if(ioHttps){
                    ioHttps.sockets.to(socket.room).emit("piconnected", { connected: false });
                }

                var indx = pis.findIndex((o) => {
                    return o == socket.id;
                });



                service.post({ path: "/api/Control/CityMedia/Telemetry/Telemetry/PiDisconnect", headers: { Authorization: authorizationString }, timeout: 40000 }, { serialNumber: serialNumber }).then(data => {

                }).catch(error => {
                    console.log(error);
                });

                if (indx > -1) {
                    pis.splice(indx, 1);
                }

            });

        } else {

            //find pi connected to this room

            var piSocket = findRelatedPi(socket);
            socket.on("update", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("update", data, cb);
                }
            });
            socket.on("tossACoinToYourWitcher", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("tossACoinToYourWitcher", data, cb);
                }
            });

            socket.on("getInfo", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("getInfo", data, cb);
                }
            });

            socket.on("getErrors", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("getErrors", data, cb);
                }
            });


            socket.on("deleteErrors", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("deleteErrors", data, cb);
                }
            });


            socket.on("emptyHopper", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("emptyHopper", data, cb);
                }
            });

            socket.on("fillUpHopper", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("fillUpHopper", data, cb);
                }
            });

            socket.on("updateFirmware", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("updateFirmware", data, cb);
                }
            });

            socket.on("restart", (data, cb) => {
                var piSocket = findRelatedPi(socket);
                if (cb != null && piSocket == null || !piSocket.connected) {
                    cb(null, { message: "Pi currently unavailable" });
                }
                if (piSocket != null && piSocket.connected) {

                    piSocket.emit("restart", data, cb);
                }
            });



            var piConnected = piSocket !== undefined && piSocket.connected;
            socket.emit("piconnected", { connected: piConnected });

        }





    });
}