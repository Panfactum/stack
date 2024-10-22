import express from 'express'

const configuration = {
  port: process.env.PORT ? parseFloat(process.env.PORT) : 3000,
  host: process.env.HOST ?? 'localhost'
}

const app = express()

app.get('/health', (_req, res) => {
  res.sendStatus(200)
})

app.listen(configuration.port, configuration.host, () => {
  console.log('Server is running and listening on', process.env.PORT ?? 3000)
})


