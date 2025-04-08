
import { Writable } from 'node:stream';

export const createNullWriter = () => new Writable({
    write: () => {}
  })