import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import jwt from 'jsonwebtoken'

const configuration = {
  port: process.env.PORT ? parseFloat(process.env.PORT) : 3000,
  host: process.env.HOST ?? 'localhost',
  secret: process.env.SECRET,
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }
}

console.log('config', configuration)

const pgClient = new pg.Client(configuration.db);
const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.sendStatus(200)
})

app.post('/user/registration', async (req, res) => {
  const {username, password} = req.body

  const result = await pgClient.query('INSERT INTO users(username, password) VALUES($1, $2) RETURNING *', [username, password])
  const user = result.rows[0]
  const token = jwt.sign(user, configuration.secret)

  res.send({
    user,
    token
  })
})

app.listen(configuration.port, configuration.host, () => {
  console.log('Server is running and listening on', process.env.PORT ?? 3000)
})

await pgClient.connect()

const createTableQuery = `
  DO $$ 
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'users'
      ) THEN
          CREATE TABLE users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              username VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL
          );
      END IF;
  END $$;
`;

async function createUsersTable() {
  try {
    // Connect to the database and run the query
    await pgClient.query(createTableQuery);
    console.log('Table creation checked/completed successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

await createUsersTable()