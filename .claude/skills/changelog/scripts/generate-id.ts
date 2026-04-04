#!/usr/bin/env bun
// Generates and prints a single UUIDv4 for use as a change entry ID.

import { randomUUID } from "crypto";

console.log(randomUUID());
