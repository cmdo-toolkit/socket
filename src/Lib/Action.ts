import { Accepted, Rejected, Respond } from "../Types/Action";

export function reject(message: string, data = {}): Rejected {
  return { status: "rejected", message, data };
}

export function accept(): Accepted {
  return { status: "accepted" };
}

export function respond(data = {}): Respond {
  return { status: "responded", data };
}
