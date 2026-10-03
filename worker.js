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
      request.headers.get("Upgrade") ===
      "websocket"
    ) {

      const room =
        url.searchParams.get("room") ||
        "default";


      const id =
        env.SIGNALING_ROOM.idFromName(
          room
        );


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


// ==========================================
// SIGNALING ROOM
// ==========================================

export class SignalingRoom {

  constructor(state) {

    this.state = state;

    this.sessions = new Set();
  }


  async fetch(request) {

    if (
      request.headers.get("Upgrade") !==
      "websocket"
    ) {

      return new Response(
        "WebSocket endpoint",
        {
          status: 200
        }
      );
    }


    const pair =
      new WebSocketPair();


    const client =
      pair[0];

    const server =
      pair[1];


    server.accept();


    this.sessions.add(server);


    // Tell the client it joined
    server.send(
      JSON.stringify({
        type: "joined"
      })
    );


    server.addEventListener(
      "message",
      (event) => {

        try {

          const message =
            JSON.parse(event.data);


          // Relay signaling messages
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


          // Ping
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


    server.addEventListener(
      "close",
      () => {

        this.sessions.delete(server);
      }
    );


    server.addEventListener(
      "error",
      () => {

        this.sessions.delete(server);
      }
    );


    return new Response(
      null,
      {
        status: 101,
        webSocket: client
      }
    );
  }


  broadcast(
    message,
    sender
  ) {

    const data =
      JSON.stringify(message);


    for (
      const session of this.sessions
    ) {

      if (
        session !== sender
      ) {

        try {

          session.send(data);

        } catch (error) {

          this.sessions.delete(
            session
          );
        }
      }
    }
  }
}
