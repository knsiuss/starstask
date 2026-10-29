#!/usr/bin/env node
/**
 * Prints a fresh RATE_LIMIT_SALT value. Rotating the salt invalidates existing
 * rate-limit buckets, which is the intended way to clear a stuck counter.
 */
import { randomBytes } from "node:crypto";

console.log(randomBytes(32).toString("hex"));
