const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  writeFileWithoutOverwrite,
} = require("../electron/utils/nonDestructiveFileSave.ts");

const run = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stickycake-no-overwrite-"));
  const targetPath = path.join(tempDir, "report.pdf");

  try {
    fs.writeFileSync(targetPath, "original");
    fs.writeFileSync(path.join(tempDir, "report (1).pdf"), "first copy");

    const savedPath = await writeFileWithoutOverwrite(
      targetPath,
      Buffer.from("downloaded"),
    );

    assert.equal(savedPath, path.join(tempDir, "report (2).pdf"));
    assert.equal(fs.readFileSync(targetPath, "utf8"), "original");
    assert.equal(
      fs.readFileSync(path.join(tempDir, "report (1).pdf"), "utf8"),
      "first copy",
    );
    assert.equal(fs.readFileSync(savedPath, "utf8"), "downloaded");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

run()
  .then(() => console.log("nonDestructiveFileSave tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
