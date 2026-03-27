import pg from 'pg'
import { configuration } from "@/configuration";


export const pgClient = new pg.Client(configuration.db);