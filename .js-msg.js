const fs = require("fs")
const os = require("os")
const path = require("path")
const { execSync } = require("child_process")

module.exports = (userConfig) => {
  let md = require("markdown-it")({
    html: true,
    linkify: true,
  })
  .use(require("markdown-it-anchor"), {
    level: 1,
    permalink: true,
  })
  .use(require("markdown-it-katex"))

  userConfig.getMarkdown = () => md,

  userConfig.addLiquidTag("srclink", function(name) {
    return {
      render: function(data) {
        var baseUrl = "https://github.com/mechpen/mechpen.github.io/blob/src"
        var subPath = data._url.split("/")

        subPath.pop()
        subPath.push(name)
        return baseUrl + subPath.join("/")
      }
    }
  })

  userConfig.addLiquidTag("loadpgf", function(name) {
    return {
      render: function(data) {
        var base = path.basename(name, ".tex")
        var srcDir = path.dirname(data._src)
        var dstDir = path.dirname(data._dst)
        var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-"))
        var cmd

        cmd = `pdflatex -halt-on-error -output-directory ${tmpDir} ${srcDir}/${name}`
        console.log("Running", cmd)
        execSync(cmd)

        fs.mkdirSync(dstDir, {recursive: true})
        cmd = `pdftoppm -r 110 -png -singlefile ${tmpDir}/${base}.pdf ${dstDir}/${base}`
        console.log("Running", cmd)
        execSync(cmd)

        fs.rmdirSync(tmpDir, {recursive: true})
        return `<img src="${base}.png" />`
      },
    }
  })
}
