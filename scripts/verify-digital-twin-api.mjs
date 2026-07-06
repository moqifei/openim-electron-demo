/**
 * 验证 digitalTwin.ts 和 digitalTwinStorage.ts 的导入和导出
 * 运行方式: node --experimental-specifier-resolution=node scripts/verify-digital-twin-api.mjs
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 由于 Electron 使用了 Vite 的路径别名 @/，我们需要手动映射
const aliases = {
  "@/api/digitalTwin": path.join(__dirname, "../src/api/digitalTwin.ts"),
  "@/utils/digitalTwinStorage": path.join(__dirname, "../src/utils/digitalTwinStorage.ts"),
};

console.log("=== 验证 digitalTwin API ===\n");

// 1. 检查文件是否存在
import { existsSync } from "fs";

const files = [
  aliases["@/api/digitalTwin"],
  aliases["@/utils/digitalTwinStorage"],
];

for (const file of files) {
  const exists = existsSync(file);
  console.log(`${exists ? "✓" : "✗"} 文件存在: ${path.basename(file)}`);
}

// 2. 检查 TypeScript 类型（通过 tsc）
import { execSync } from "child_process";

try {
  console.log("\n运行 tsc --noEmit 检查类型...");
  execSync('pnpm exec tsc --noEmit src/api/digitalTwin.ts src/utils/digitalTwinStorage.ts', {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
  console.log("✓ 类型检查通过");
} catch (err) {
  console.log("✗ 类型检查失败（可能是既有项目的其他类型问题）");
}

// 3. 检查导出（通过读取源码）
import { readFileSync } from "fs";

const apiContent = readFileSync(aliases["@/api/digitalTwin"], "utf-8");
const storageContent = readFileSync(aliases["@/utils/digitalTwinStorage"], "utf-8");

console.log("\n--- src/api/digitalTwin.ts 导出 ---");
const apiExports = apiContent.match(/export (const|function|type|interface) (\w+)/g) || [];
apiExports.forEach((exp) => console.log("  " + exp.replace("export ", "")));

console.log("\n--- src/utils/digitalTwinStorage.ts 导出 ---");
const storageExports = storageContent.match(/export (const|function|type|interface) (\w+)/g) || [];
storageExports.forEach((exp) => console.log("  " + exp.replace("export ", "")));

// 4. 验证关键函数是否存在
const requiredApiFunctions = ["getDigitalTwinConfig", "updateDigitalTwinConfig", "getPersistedDigitalTwinConfig"];
const requiredStorageFunctions = ["setCachedDigitalTwinConfig", "getCachedDigitalTwinConfig", "clearCachedDigitalTwinConfig"];

console.log("\n--- 关键函数检查 ---");
for (const fn of requiredApiFunctions) {
  const hasFn = apiContent.includes(`export const ${fn}`) || apiContent.includes(`export function ${fn}`);
  console.log(`${hasFn ? "✓" : "✗"} ${fn}`);
}

for (const fn of requiredStorageFunctions) {
  const hasFn = storageContent.includes(`export const ${fn}`) || storageContent.includes(`export function ${fn}`);
  console.log(`${hasFn ? "✓" : "✗"} ${fn}`);
}

console.log("\n=== 验证完成 ===");
