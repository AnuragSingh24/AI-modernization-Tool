import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

export function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured in .env.`);
  }

  return value;
}

export function numberEnv(name) {
  const value = Number(requiredEnv(name));

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a valid number in .env.`);
  }

  return value;
}

export function optionalNumberEnv(name) {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${name} must be a valid number in .env.`);
  }

  return parsedValue;
}

export function booleanEnv(name) {
  return process.env[name] === "true";
}

export function csvEnv(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
