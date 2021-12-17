import { WebSocket } from "ws";

import type { Server } from "./Server";

type Clients = Set<WebSocket>;
type Excluded = Map<WebSocket, boolean>;

export class Channel {
  public readonly channelId: string;

  public readonly server: Server;
  public readonly clients: Clients;
  public readonly excluded: Excluded;

  constructor(channelId: string, server: Server, excluded: Excluded = new Map()) {
    this.channelId = channelId;

    this.server = server;
    this.excluded = excluded;
    this.clients = new Set();

    this.populate();
  }

  /**
   * Assign broadcast target for an event.
   */
  private populate(): this {
    const channel = this.server.channels.get(this.channelId);
    if (channel) {
      for (const client of channel) {
        if (client.readyState !== WebSocket.OPEN) {
          this.server.leave(this.channelId, client); // clean up trash sockets
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
   * @example
   *
   * ```ts
   * server.to(channelId).emit("foo", { bar: "foobar" }); // => emit to all clients
   * socket.to(channelId).emit("foo", { bar: "foobar" }); // => emit to specific client
   * ```
   *
   */
  public emit(type: string, data: Record<string, unknown> = {}) {
    const message = JSON.stringify({ type, data });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN && !this.excluded.has(client)) {
        client.send(message);
      }
    }
    this.server.redis?.publish(this.channelId, message);
  }
}
