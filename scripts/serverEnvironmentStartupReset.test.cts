import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const config = read("src/utils/config.ts");
const startup = read("src/layout/MainContentWrap.tsx");

const resetFunction = config.match(
  /export function resetServerEnvironmentForStartup\(\): void \{([\s\S]*?)\n\}/,
);

assert.ok(
  resetFunction,
  "config should expose a startup reset for previous server-environment state",
);

for (const key of [
  "MANUAL_SERVER_HOST_KEY",
  "IM_HOST_KEY",
  "CHAT_HOST_KEY",
  "SELECTED_SERVER_ENVIRONMENT_KEY",
]) {
  assert.match(
    resetFunction[1],
    new RegExp(`localStorage\\.removeItem\\(${key}\\)`),
    `startup reset should remove ${key}`,
  );
}

assert.match(
  startup,
  /resetServerEnvironmentForStartup\(\);[\s\S]*?navigate\("\/login", \{ replace: true \}\);/,
  "startup should clear previous server state before showing the login page",
);

console.log("server environment startup reset tests passed");
