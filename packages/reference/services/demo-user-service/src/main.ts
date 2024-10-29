import 'dotenv/config'
import express from 'express'
import jwt from 'jsonwebtoken'

import { pgClient } from "@/db";
import { configuration } from "@/configuration";
import {createUsersTable} from "@/createUsersTable";
import { redisCache } from "@/cache";


async function redisCheck() {
  let value = await redisCache.get('time')

  if (!value) {
    value = Date.now().toString()
    await redisCache.set('time', value, "EX", 10)

    console.log('new time value', value)
  }

  return value
}


const app = express()

app.use(express.json())
app.get('/health', async (_req, res) => {
  await redisCheck()
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

await createUsersTable()

