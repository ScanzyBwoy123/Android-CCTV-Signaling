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


export class SignalingRoom {

  constructor(state) {
    this.state = state;
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


    const pair =
      new WebSocketPair();

    const client =
      pair[0];

    const server =
      pair[1];


    // Cloudflare Durable Object
    // WebSocket Hibernation API
    this.state.acceptWebSocket(server);


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


  webSocketMessage(ws, message) {

    try {

      const data =
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(
              new TextDecoder().decode(message)
            );


      console.log(
        "Received:",
        data.type
      );


      // Keep connection alive
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

        return;
      }

    } catch (error) {

      console.error(
        "WebSocket message error:",
        error
      );
    }
  }


  webSocketClose(
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


  webSocketError(
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
      this.state.getWebSockets();


    for (
      const socket of sockets
    ) {

      if (
        socket !== sender
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
