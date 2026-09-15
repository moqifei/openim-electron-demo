const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { downloadFileNative } = require("../electron/main/nativeFileDownload.ts");

const logger = {
  info: () => undefined,
  error: () => undefined,
};

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      resolve(address.port);
    });
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const run = async () => {
  const payload = Buffer.from("streamed native download");
  const server = http.createServer((request, response) => {
    if (request.url === "/ok") {
      response.writeHead(200, {
        "Content-Length": payload.length,
        "Content-Type": "application/octet-stream",
      });
      response.end(payload);
      return;
    }

    if (request.url === "/slow") {
      response.writeHead(200, {
        "Content-Length": 1024 * 1024,
        "Content-Type": "application/octet-stream",
      });
      response.write(Buffer.alloc(64 * 1024, 1));
      setTimeout(() => response.end(Buffer.alloc(960 * 1024, 1)), 100);
      return;
    }

    response.writeHead(200, { "Content-Length": 1024 * 1024 });
    response.write(Buffer.alloc(64 * 1024, 1));
    setTimeout(() => response.socket?.destroy(), 10);
  });

  const port = await listen(server);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stickycake-native-download-"));
  const successPath = path.join(tempDir, "success.bin");

  try {
    const savedPath = await downloadFileNative({
      url: `http://127.0.0.1:${port}/ok`,
      targetPath: successPath,
      requestId: "success",
      logger,
    });
    assert.equal(savedPath, successPath);
    assert.deepEqual(fs.readFileSync(successPath), payload);

    await assert.rejects(
      downloadFileNative({
        url: `http://127.0.0.1:${port}/reset`,
        targetPath: path.join(tempDir, "reset.bin"),
        requestId: "reset",
        logger,
      }),
      (error) => Boolean(error.downloaded > 0 && error.code),
    );

    const controller = new AbortController();
    const cancelledPath = path.join(tempDir, "cancelled.bin");
    const pendingDownload = downloadFileNative({
      url: `http://127.0.0.1:${port}/slow`,
      targetPath: cancelledPath,
      requestId: "cancelled",
      signal: controller.signal,
      logger,
    });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      pendingDownload,
      (error) => error && error.code === "ERR_DOWNLOAD_CANCELLED",
    );
    assert.equal(fs.existsSync(cancelledPath), false);
    assert.equal(fs.existsSync(`${cancelledPath}.cancelled.part`), false);
  } finally {
    await close(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

run()
  .then(() => console.log("nativeFileDownload tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
