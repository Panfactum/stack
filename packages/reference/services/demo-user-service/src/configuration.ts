export const configuration = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  host: process.env.HOST ?? 'localhost',
  secret: process.env.SECRET ?? 'secret',
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  redis: {
    sentinelEnabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
    sentinels: [
      { host: process.env.REDIS_SENTINEL_HOST ?? 'localhost', port: process.env.REDIS_SENTINEL_PORT ? parseInt(process.env.REDIS_SENTINEL_PORT) : 26379 },
    ],
    host: process.env.REDIS_HOST ?? 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    name: process.env.REDIS_MASTER_NAME ?? 'mymaster',
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  }
}