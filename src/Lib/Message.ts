const REQUIRED_KEYS: ["uuid", "type"] = ["uuid", "type"];

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

//#region

type Body = {
  uuid: string;
  type: string;
  data: Record<string, unknown>;
};

type ValidatedMessage = {
  uuid: string;
  type: string;
  data?: Record<string, unknown>;
};

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Errors
 |--------------------------------------------------------------------------------
 */

//#region

class InvalidMessageBodyError extends Error {
  public readonly type = "InvalidMessageBodyError";

  constructor(keys: string[]) {
    super(`Socket Message Violation: Missing required '${keys.join(", ")}' key(s) in message body`);
  }
}

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Message
 |--------------------------------------------------------------------------------
 */

//#region

export class Message {
  public readonly uuid: string;
  public readonly type: string;
  public readonly data: Record<string, unknown>;

  constructor(message: string) {
    const body = getValidatedMessageBody(JSON.parse(message));
    this.uuid = body.uuid;
    this.type = body.type;
    this.data = body.data ?? {};
  }

  public toResponse(data: Record<string, unknown>): string {
    return JSON.stringify({ uuid: this.uuid, data });
  }
}

//#endregion

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

//#region

function getValidatedMessageBody(body: Partial<Body>) {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (body[key] === undefined) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new InvalidMessageBodyError(missing);
  }
  return body as ValidatedMessage;
}

//#endregion
