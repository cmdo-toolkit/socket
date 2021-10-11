import { WebSocket } from "ws";

import type { Server } from "./Server";

export class Channel {
  public clients = new Set<WebSocket>();

  constructor(public server: Server, public readonly excluded: Map<WebSocket, boolean> = new Map()) {}

  /**
   * Assign broadcast target for an event.
   */
  public to(channelId: string): this {
    const channel = this.server.channels.get(channelId);
    if (channel) {
      for (const client of channel) {
        if (client.readyState !== WebSocket.OPEN) {
          this.server.leave(channelId, client); // clean up trash sockets
        } else {
          this.clients.add(client);
        }
      }
    }
    return this;
  }

  /**
   * Emit a broadcast to all clients within the assigned rooms.
   *
   * @remarks
   *
   * If a client is part of one or more of the assigned rooms, the event is only
   * broadcast once regardless of how many rooms the client is connectd to.
   *
   *
   * @example
   *
   * ```ts
   * server.to(channelId).emit("foo", { bar: "foobar" }); // => emit to all clients
   * socket.to(channelId).emit("foo", { bar: "foobar" }); // => emit to specific client
   * ```
   *
   */
  public emit(type: string, data: Record<string, unknown> = {}) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN && !this.excluded.has(client)) {
        client.send(JSON.stringify({ type, data }));
      }
    }
  }
}
