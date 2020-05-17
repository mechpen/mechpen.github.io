const fs = require("fs")
const path = require("path")
const webpack = require("webpack")
const { JSDOM } = require("jsdom")
const { tmpDir } = require("./tmpDir")

let scriptFile = "domScript.js"

let script = new Promise((resolve, reject) => {
  webpack({
    entry: path.join(__dirname, scriptFile),
    output: {
      path: tmpDir,
      filename: scriptFile,
    },
    optimization: {
      minimize: false,
    },
    mode: "production",
  }, (err, stats) => {
    if (err) {
      reject(err)
    } else if (stats.hasErrors()) {
      reject(stats.toString())
    } else {
      resolve(fs.readFileSync(path.join(tmpDir, scriptFile), "utf-8"))
    }
  })
})

async function process(content) {
  let dom = new JSDOM(content, { runScripts: "outside-only" })
  dom.window.eval(await script)
  return dom.serialize()
}

module.exports = {
  process,
}
