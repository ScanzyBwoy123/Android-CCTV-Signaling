import { DurableObject } from "cloudflare:workers";


export default {

    async fetch(request, env) {

        const url = new URL(request.url);


        // Health check
        if (
            request.method === "GET" &&
            url.pathname === "/"
        ) {

            return new Response(
                JSON.stringify({
                    status: "online",
                    service: "Android CCTV Signaling Server"
                }),
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }


        // WebSocket connection
        if (
            request.headers.get("Upgrade")?.toLowerCase() ===
            "websocket"
        ) {

            const room =
                url.searchParams.get("room") ||
                "default";


            const id =
                env.SIGNALING_ROOM.idFromName(room);


            const stub =
                env.SIGNALING_ROOM.get(id);


            return stub.fetch(request);
        }


        return new Response(
            "Android CCTV Signaling Server",
            {
                status: 200
            }
        );
    }
};



export class SignalingRoom extends DurableObject {


    constructor(ctx, env) {

        super(ctx, env);

        this.ctx = ctx;
        this.env = env;
    }



    async fetch(request) {

        if (
            request.headers.get("Upgrade")?.toLowerCase() !==
            "websocket"
        ) {

            return new Response(
                "WebSocket endpoint",
                {
                    status: 400
                }
            );
        }


        const webSocketPair =
            new WebSocketPair();


        const [client, server] =
            Object.values(webSocketPair);


        // Accept using Cloudflare's
        // Durable Object WebSocket API
        this.ctx.acceptWebSocket(server);


        // Identify this connection
        server.serializeAttachment({
            joinedAt: Date.now()
        });


        // Tell the client it connected
        server.send(
            JSON.stringify({
                type: "joined"
            })
        );


        return new Response(
            null,
            {
                status: 101,
                webSocket: client
            }
        );
    }



    async webSocketMessage(
        ws,
        message
    ) {

        try {

            const data =
                typeof message === "string"
                    ? JSON.parse(message)
                    : JSON.parse(
                        new TextDecoder().decode(message)
                    );


            console.log(
                "WebSocket message:",
                data.type
            );


            // Ping
            if (
                data.type === "ping"
            ) {

                ws.send(
                    JSON.stringify({
                        type: "pong"
                    })
                );

                return;
            }


            // WebRTC signaling
            if (
                data.type === "offer" ||
                data.type === "answer" ||
                data.type === "candidate"
            ) {

                this.broadcast(
                    data,
                    ws
                );
            }

        } catch (error) {

            console.error(
                "WebSocket message error:",
                error
            );
        }
    }



    async webSocketClose(
        ws,
        code,
        reason,
        wasClean
    ) {

        console.log(
            "WebSocket closed:",
            code,
            reason,
            wasClean
        );
    }



    async webSocketError(
        ws,
        error
    ) {

        console.error(
            "WebSocket error:",
            error
        );
    }



    broadcast(
        message,
        sender
    ) {

        const data =
            JSON.stringify(message);


        const sockets =
            this.ctx.getWebSockets();


        for (
            const socket of sockets
        ) {

            if (
                socket !== sender &&
                socket.readyState === WebSocket.OPEN
            ) {

                try {

                    socket.send(data);

                } catch (error) {

                    console.error(
                        "Broadcast error:",
                        error
                    );
                }
            }
        }
    }
}
