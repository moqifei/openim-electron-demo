const { spawnSync } = require("child_process");
const path = require("path");

module.exports = async function beforePackBundledGlibc(context) {
  if (context.electronPlatformName !== "linux") {
    return;
  }
  if (process.env.USE_BUNDLED_GLIBC !== "1") {
    return;
  }

  const projectDir = context.packager.projectDir;
  const scriptPath = path.join(projectDir, "scripts", "prepareBundledGlibc.sh");
  const env = { ...process.env };

  if (env.BUNDLED_GLIBC_DIR && !env.BUNDLED_GLIBC_INSTALL_DIR) {
    env.BUNDLED_GLIBC_INSTALL_DIR = path.resolve(projectDir, env.BUNDLED_GLIBC_DIR);
  }

  const result = spawnSync("bash", [scriptPath, "x64"], {
    cwd: projectDir,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to prepare bundled glibc, exit code ${result.status}`);
  }
};
