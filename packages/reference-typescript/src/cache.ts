import Redis from "ioredis";
import { configuration } from "./configuration";

const redisConfiguration = configuration.redis.sentinelEnabled ? {
  sentinels: configuration.redis.sentinels,
  name: configuration.redis.name,
  username: configuration.redis.username,
  password: configuration.redis.password,
  sentinelUsername: configuration.redis.username,
  sentinelPassword: configuration.redis.password,
} : {
  host: configuration.redis.host,
  port: configuration.redis.port,
  username: configuration.redis.username,
  password: configuration.redis.password,
}

export const redisCache = new Redis(redisConfiguration)