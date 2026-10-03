const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
    res.json({
        status: "online",
        service: "Android CCTV Signaling Server"
    });
});

const server = http.createServer(app);

const wss = new WebSocket.Server({
    server: server
});

const rooms = new Map();

wss.on("connection", (socket) => {

    console.log("Client connected");

    socket.on("message", (message) => {

        try {

            const data = JSON.parse(message);

            // Join a room
            if (data.type === "join") {

                const roomId = data.room;

                socket.room = roomId;

                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }

                const room =
                    rooms.get(roomId);

                room.add(socket);

                console.log(
                    `Client joined room: ${roomId}`
                );

                // Tell the new client how many
                // devices are in the room
                socket.send(
                    JSON.stringify({
                        type: "joined",
                        room: roomId,
                        clients: room.size
                    })
                );

                // Tell the other client
                room.forEach((client) => {

                    if (
                        client !== socket &&
                        client.readyState ===
                        WebSocket.OPEN
                    ) {

                        client.send(
                            JSON.stringify({
                                type: "peer-joined"
                            })
                        );
                    }
                });

                return;
            }


            // Relay WebRTC signaling data
            if (
                data.type === "offer" ||
                data.type === "answer" ||
                data.type === "candidate"
            ) {

                const room =
                    rooms.get(socket.room);

                if (!room) {
                    return;
                }

                room.forEach((client) => {

                    if (
                        client !== socket &&
                        client.readyState ===
                        WebSocket.OPEN
                    ) {

                        client.send(
                            JSON.stringify(data)
                        );
                    }
                });

                return;
            }

        } catch (error) {

            console.error(
                "Message error:",
                error
            );
        }
    });


    socket.on("close", () => {

        console.log("Client disconnected");

        const roomId =
            socket.room;

        if (!roomId) {
            return;
        }

        const room =
            rooms.get(roomId);

        if (!room) {
            return;
        }

        room.delete(socket);

        room.forEach((client) => {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {

                client.send(
                    JSON.stringify({
                        type: "peer-left"
                    })
                );
            }
        });

        if (room.size === 0) {
            rooms.delete(roomId);
        }
    });

});


const PORT =
    process.env.PORT || 3000;


server.listen(PORT, () => {

    console.log(
        `Android CCTV signaling server running on port ${PORT}`
    );

});
