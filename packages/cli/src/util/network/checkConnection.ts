import net from "node:net";

export async function checkConnection(ip: string, port: number = 80): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.createConnection({
            host: ip,
            port: port,
            timeout: 3000 // 3 second timeout
        });

        socket.on('connect', () => {
            socket.end();
            resolve(true); // Connection successful
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false); // Connection timed out
        });

        socket.on('error', () => {
            resolve(false); // Connection rejected/blocked
        });
    });
}