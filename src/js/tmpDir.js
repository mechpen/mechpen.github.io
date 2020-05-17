const os = require("os")
const fs = require("fs")
const path = require("path")

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-"))
process.on("exit", () => { fs.rmdirSync(tmpDir, {recursive: true}) })

module.exports = {
  tmpDir,
}
