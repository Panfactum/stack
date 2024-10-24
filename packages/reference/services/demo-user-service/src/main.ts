import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import jwt from 'jsonwebtoken'

const configuration = {
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

const pgClient = new pg.Client(configuration.db);
const app = express()

app.use(express.json())

app.use((req, _res, next) => {
  console.log('url', req.url)
  next()
})

app.get('/health', (_req, res) => {
  res.sendStatus(200)
})

app.post('/registration', async (req, res) => {
  const {username, password} = req.body

  const result = await pgClient.query('INSERT INTO users(username, password) VALUES($1, $2) RETURNING *', [username, password])
  const user = result.rows[0]
  const token = jwt.sign({id: user.id, username: user.username}, configuration.secret)

  res.send({
    token
  })
})

app.get('/validate', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    res.status(401).send({error: 'Token is required'})
    return
  }

  try {
    const decoded = jwt.verify(token, configuration.secret) as {id: string, username: string}
    const result = await pgClient.query('SELECT * FROM users WHERE id = $1', [decoded.id])

    res.sendStatus(result.rows.length > 0 ? 200 : 401)
  } catch (error) {
    res.status(401).send({error: 'Invalid token'})
  }
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