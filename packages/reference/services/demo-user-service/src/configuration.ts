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
  }
}