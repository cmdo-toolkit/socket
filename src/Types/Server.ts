import type { RedisOptions } from "ioredis";

export type Settings = {
  urlPath: string;
  redis?: RedisOptions;
};
