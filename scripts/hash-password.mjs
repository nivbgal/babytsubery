#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 210_000;

async function hiddenPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Pass the password as an argument when no interactive terminal is available.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (character) => {
      if (character === "\u0003") {
        finish();
        reject(new Error("Cancelled."));
      } else if (character === "\r" || character === "\n") {
        finish();
        resolve(value);
      } else if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else if (character >= " ") {
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  const password = process.argv[2] ?? await hiddenPassword("Parent password: ");
  if (!password) throw new Error("Password must not be empty.");
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  process.stdout.write(`pbkdf2_sha256$${ITERATIONS}$${salt.toString("base64")}$${digest.toString("base64")}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Unable to hash password."}\n`);
  process.exitCode = 1;
}
