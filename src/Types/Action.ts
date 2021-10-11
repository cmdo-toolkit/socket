import type { Client } from "../Lib/Client";

export type Action<Data extends Record<string, unknown> = any> = (this: ActionResponse, socket: Client, data: Data) => Response;

export type Response = Promise<Rejected | Accepted | Respond>;

type ActionResponse = {
  reject(message: string, data?: any): Rejected;
  accept(): Accepted;
  respond(data?: any): Respond;
};

export type Rejected = {
  status: "rejected";
  message: string;
  data: any;
};

export type Accepted = {
  status: "accepted";
};

export type Respond = {
  status: "responded";
  data?: any;
};
