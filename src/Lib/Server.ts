import * as http from "http";
import Redis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";

import { ActionHandlersNotFoundError } from "../Errors/Server";
import type { Action } from "../Types/Action";
import type { Settings } from "../Types/Server";
import { getPathname } from "../Utils/Server";
import * as responses from "./Action";
import { Channel } from "./Channel";
import { Client } from "./Client";
import { Message } from "./Message";
import { Route } from "./Route";

export class Server {
  public readonly routes = new Map<string, Action[]>();
  public readonly channels = new Map<string, Set<WebSocket>>();

  public readonly settings: Settings;
  public readonly actions: Action[];

  public instance?: WebSocketServer;
  public redis?: InstanceType<typeof Redis>;

  constructor(settings?: Partial<Settings>, actions: Action[] = []) {
    this.settings = {
      urlPath: settings?.urlPath ?? "/socket",
      redis: settings?.redis
    };
    this.actions = actions;
  }

  /*
   |--------------------------------------------------------------------------------
   | Accessors
   |--------------------------------------------------------------------------------
   */

  public set server(server: WebSocketServer) {
    this.instance = server;
  }

  public get server(): WebSocketServer {
    if (!this.instance) {
      throw new Error("WebSocket Server Violation > Server instance has not been assigned!");
    }
    return this.instance;
  }

  public get clients() {
    return this.server.clients;
  }

  /*
   |--------------------------------------------------------------------------------
   | Setup
   |--------------------------------------------------------------------------------
   */

  public register(routes: Route[]) {
    for (const route of routes) {
      this.routes.set(route.event, [...this.actions, ...route.actions]);
    }
  }

  /*
   |--------------------------------------------------------------------------------
   | Connect
   |--------------------------------------------------------------------------------
   */

  public connect(portOrServer: number | http.Server): void {
    if (typeof portOrServer === "number") {
      this.server = new WebSocketServer({ port: portOrServer });
    } else {
      this.server = new WebSocketServer({ noServer: true });
      this.addUpgradeListener(portOrServer);
    }
    this.addConnectionListener();
    this.addRedisListener();
  }

  private addUpgradeListener(httpServer: http.Server): void {
    httpServer.on("upgrade", (req, socket, head) => {
      const pathname = getPathname(req);
      if (pathname === this.settings.urlPath) {
        this.server.handleUpgrade(req, socket as any, head, (ws) => {
          this.server.emit("connection", ws, req);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private addConnectionListener(): void {
    this.server.on("connection", (socket) => {
      const client = new Client(this, socket);

      console.log(`WebSocket Server > Client ${client.clientId} connected.`);

      socket.on("message", (data, isBinary) => {
        const message = isBinary ? data : data.toString();
        if (typeof message === "string") {
          this.onMessage(client, message);
        }
      });

      socket.on("close", (code, data) => {
        console.log(`WebSocket Server > Client ${client.clientId} disconnected > ${code} ${data.toString()}`);
      });
    });
  }

  private addRedisListener(): void {
    if (this.settings.redis === undefined) {
      return; // redis has not been configured so we skip the this operation
    }

    this.redis = new Redis(this.settings.redis);

    this.redis.on("message", (channel: string, message: string) => {
      const { type, data } = JSON.parse(message);
      if (channel === "broadcast") {
        this.broadcast(type, data, false);
      } else {
        this.to(channel).emit(type, data);
      }
    });
  }

  /*
   |--------------------------------------------------------------------------------
   | Rooms
   |--------------------------------------------------------------------------------
   */

  /**
   * Assign provided socket to the provided room.
   */
  public join(channelId: string, socket: WebSocket): this {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.add(socket);
    } else {
      this.channels.set(channelId, new Set([socket]));
    }
    return this;
  }

  /**
   * Remove provided socket from the provided room.
   */
  public leave(channelId: string, socket: WebSocket): this {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.delete(socket);
      if (channel.size < 1) {
        this.channels.delete(channelId);
      }
    }
    return this;
  }

  /*
   |--------------------------------------------------------------------------------
   | Emitters
   |--------------------------------------------------------------------------------
   */

  /**
   * Broadcast a event to all clients.
   */
  public broadcast(type: string, data: Record<string, unknown> = {}, origin = true): this {
    const message = JSON.stringify({ type, data });
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
    if (origin) {
      this.redis?.publish("broadcast", message);
    }
    return this;
  }

  /**
   * Broadcast a event to all clients in the provided channel.
   */
  public to(channelId: string): Channel {
    return new Channel(channelId, this);
  }

  /*
   |--------------------------------------------------------------------------------
   | Listeners
   |--------------------------------------------------------------------------------
   */

  private async onMessage(client: Client, str: string): Promise<void> {
    let message: Message | undefined;
    try {
      message = new Message(str);
      for (const action of this.getActions(message.type)) {
        const res = await action.call(responses, client, message.data);
        switch (res.status) {
          case "accepted": {
            break;
          }
          case "rejected":
          case "responded": {
            return client.socket.send(message.toResponse(res));
          }
        }
      }
    } catch (err: any) {
      client.socket.send(
        message?.toResponse(
          responses.reject(err.message, {
            type: message?.type,
            data: message?.data
          })
        )
      );
    }
  }

  /*
   |--------------------------------------------------------------------------------
   | Utilities
   |--------------------------------------------------------------------------------
   */

  private getActions(type: string): Action[] {
    const actions = this.routes.get(type);
    if (!actions) {
      throw new ActionHandlersNotFoundError(type);
    }
    return actions;
  }
}
