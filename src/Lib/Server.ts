import * as http from "http";
import { URL } from "url";
import { WebSocket, WebSocketServer } from "ws";

import type { Action } from "./Action";
import * as responses from "./Action";
import { Channel } from "./Channel";
import { Client } from "./Client";
import { Message } from "./Message";
import { Route } from "./Route";

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

//#region

type Settings = {
  urlPath: string;
};

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Errors
 |--------------------------------------------------------------------------------
 */

//#region

class ActionHandlersNotFoundError extends Error {
  public readonly type = "ActionHandlersNotFoundError";

  constructor(type: string) {
    super(`Socket Message Violation: Provided message type '${type}' has no registered handlers`);
  }
}

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Server
 |--------------------------------------------------------------------------------
 */

//#region

export class Server {
  public readonly routes = new Map<string, Action[]>();
  public readonly channels = new Map<string, Set<WebSocket>>();

  public readonly settings: Settings;
  public readonly actions: Action[];

  private _server?: WebSocketServer;

  constructor(settings?: Partial<Settings>, actions: Action[] = []) {
    this.settings = {
      urlPath: settings?.urlPath ?? "/socket"
    };
    this.actions = actions;
  }

  /*
   |--------------------------------------------------------------------------------
   | Accessors
   |--------------------------------------------------------------------------------
   */

  //#region

  public set server(server: WebSocketServer) {
    this._server = server;
  }

  public get server(): WebSocketServer {
    if (!this._server) {
      throw new Error("WebSocket Server Violation > Server instance has not been assigned!");
    }
    return this._server;
  }

  public get clients() {
    return this.server.clients;
  }

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Setup
   |--------------------------------------------------------------------------------
   */

  //#region

  public register(routes: Route[]) {
    for (const route of routes) {
      this.routes.set(route.event, [...this.actions, ...route.actions]);
    }
  }

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Connect
   |--------------------------------------------------------------------------------
   */

  //#region

  public connect(portOrServer: number | http.Server): void {
    if (typeof portOrServer === "number") {
      this.server = new WebSocketServer({ port: portOrServer });
    } else {
      this.server = new WebSocketServer({ noServer: true });
      this.addUpgradeListener(portOrServer);
    }
    this.addConnectionListener();
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

      console.log(`WebSocket Server > Client ${client.id} connected.`);

      socket.on("message", (data, isBinary) => {
        const message = isBinary ? data : data.toString();
        if (typeof message === "string") {
          this.onMessage(client, message);
        }
      });

      socket.on("close", (code, data) => {
        console.log(`WebSocket Server > Client ${client.id} disconnected > ${code} ${data.toString()}`);
      });
    });
  }

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Rooms
   |--------------------------------------------------------------------------------
   */

  //#region

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
    }
    return this;
  }

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Emitters
   |--------------------------------------------------------------------------------
   */

  //#region

  /**
   * Broadcast a event to all clients.
   */
  public broadcast(type: string, data: Record<string, unknown> = {}): this {
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data }));
      }
    }
    return this;
  }

  /**
   * Broadcast a event to all clients in the provided channel.
   */
  public to(channelId: string): Channel {
    return new Channel(this).to(channelId);
  }

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Listeners
   |--------------------------------------------------------------------------------
   */

  //#region

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

  //#endregion

  /*
   |--------------------------------------------------------------------------------
   | Utilities
   |--------------------------------------------------------------------------------
   */

  //#region

  private getActions(type: string): Action[] {
    const actions = this.routes.get(type);
    if (!actions) {
      throw new ActionHandlersNotFoundError(type);
    }
    return actions;
  }

  //#endregion
}

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

//#region

function getPathname(req: any): string {
  return new URL(req.url, req.protocol + "://" + req.headers.host + "/").pathname;
}

//#endregion
