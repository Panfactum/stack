// Utility function to wait for a port to become available
import net from 'net'
import { CLIError } from '@/util/error/error'

interface WaitForPortOptions {
  port: number
  host?: string
  maxAttempts?: number
  retryDelay?: number
}

export async function waitForPort({
  port,
  host = '127.0.0.1',
  maxAttempts = 30,
  retryDelay = 1000
}: WaitForPortOptions): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection(port, host)
      socket.on('connect', () => {
        socket.end()
        resolve(true)
      })
      socket.on('error', () => {
        resolve(false)
      })
    })

    if (connected) {
      return
    }

    await Bun.sleep(retryDelay)
  }

  throw new CLIError(`Port ${port} on ${host} did not become available after ${maxAttempts} attempts`)
}