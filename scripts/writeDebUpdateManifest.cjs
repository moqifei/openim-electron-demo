const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const projectDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(projectDir, "package.json"));

const getDebOutputDir = (version = packageJson.version) =>
  path.join(projectDir, "release", "StickyCake", version);

const getDebFileInfo = async (outputDir, fileName) => {
  const filePath = path.join(outputDir, fileName);
  const data = await fs.promises.readFile(filePath);
  const stats = await fs.promises.stat(filePath);
  return {
    url: fileName,
    sha512: crypto.createHash("sha512").update(data).digest("base64"),
    size: stats.size,
  };
};

const createDebUpdateManifest = async (outputDir, version = packageJson.version) => {
  const fileNames = (await fs.promises.readdir(outputDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".deb"))
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`No .deb artifact found in ${outputDir}`);
  }

  return {
    version,
    files: await Promise.all(fileNames.map((fileName) => getDebFileInfo(outputDir, fileName))),
  };
};

const writeDebUpdateManifest = async (
  outputDir,
  version = packageJson.version,
) => {
  const manifest = {
    ...(await createDebUpdateManifest(outputDir, version)),
    releaseDate: new Date().toISOString(),
  };
  const manifestPath = path.join(outputDir, "latest-linux.yml");
  await fs.promises.writeFile(manifestPath, yaml.dump(manifest), "utf8");
  return manifestPath;
};

if (require.main === module) {
  writeDebUpdateManifest(getDebOutputDir())
    .then((manifestPath) => console.log(`Wrote ${manifestPath}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  createDebUpdateManifest,
  getDebOutputDir,
  writeDebUpdateManifest,
};
