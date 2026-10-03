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


    this.state.acceptWebSocket(server);


    server.addEventListener(
      "message",
      (event) => {

        try {

          const message =
            JSON.parse(event.data);


          if (
            message.type === "offer" ||
            message.type === "answer" ||
            message.type === "candidate"
          ) {

            this.broadcast(
              message,
              server
            );

            return;
          }


          if (
            message.type === "ping"
          ) {

            server.send(
              JSON.stringify({
                type: "pong"
              })
            );
          }

        } catch (error) {

          console.error(
            "Message error:",
            error
          );
        }
      }
    );


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


  broadcast(message, sender) {

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


  webSocketClose(ws) {

    console.log(
      "WebSocket closed"
    );
  }


  webSocketError(ws, error) {

    console.error(
      "WebSocket error:",
      error
    );
  }
}
