import { Client } from "./Client";

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

//#region

export type Action<Data extends Record<string, unknown> = any> = (this: ActionResponse, socket: Client, data: Data) => Response;

export type Response = Promise<Rejected | Accepted | Respond>;

type ActionResponse = {
  reject(message: string, data?: any): Rejected;
  accept(): Accepted;
  respond(data?: any): Respond;
};

type Rejected = {
  status: "rejected";
  message: string;
  data: any;
};

type Accepted = {
  status: "accepted";
};

type Respond = {
  status: "responded";
  data?: any;
};

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Responses
 |--------------------------------------------------------------------------------
 */

//#region

export function reject(message: string, data = {}): Rejected {
  return { status: "rejected", message, data };
}

export function accept(): Accepted {
  return { status: "accepted" };
}

export function respond(data = {}): Respond {
  return { status: "responded", data };
}

//#endregion
