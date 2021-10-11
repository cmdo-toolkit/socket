import { WebSocket } from "ws";

import { Channel } from "./Channel";
import type { Server } from "./Server";
import { uuid } from "./Utils";

/*
 |--------------------------------------------------------------------------------
 | Interfaces
 |--------------------------------------------------------------------------------
 */

//#region

interface SocketClient {
  id: string;
}

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Client
 |--------------------------------------------------------------------------------
 */

//#region

export class Client implements SocketClient {
  public id: string;

  constructor(public readonly server: Server, public readonly socket: WebSocket) {
    this.id = uuid();
  }

  /**
   * Emit a message to this client.
   *
   * @param type - Message type.
   * @param data - Data object to send.
   *
   * @returns Client
   */
  public emit(type: string, data: Record<string, unknown> = {}) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    }
    return this;
  }

  /**
   * Broadcast a message to all clients except this client.
   *
   * @param type - Message type.
   * @param data - Data object to send.
   *
   * @returns Client
   */
  public broadcast(type: string, data: Record<string, unknown> = {}) {
    for (const client of this.server.clients) {
      if (client !== this.socket && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data }));
      }
    }
    return this;
  }

  /**
   * Broadcast a event to all clients in the provided room except this client.
   */
  public to(channelId: string): Channel {
    return new Channel(this.server, new Map<WebSocket, boolean>().set(this.socket, true)).to(channelId);
  }

  /**
   * Assign client to server channel.
   */
  public join(channelId: string) {
    console.log(`WebSocket Channel > Client ${this.id} entered ${channelId}`);
    this.server.join(channelId, this.socket);
    return this;
  }

  /**
   * Remove client from a server channel.
   */
  public leave(channelId: string) {
    console.log(`WebSocket Channel > Client ${this.id} left ${channelId}`);
    this.server.leave(channelId, this.socket);
    return this;
  }
}

//#endregion
