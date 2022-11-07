const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const { tmpDir } = require("./tmpDir")

function mapUrl(pathName) {
  return "/" + pathName.split(path.sep).join("/")
}

function srcLink(name) {
  return (data) => {
    let baseUrl = "https://github.com/mechpen/mechpen.github.io/blob/src"
    name = path.join(data._srcDir, path.dirname(data._current), name)
    return baseUrl + mapUrl(name)
  }
}

function loadPgf(name) {
  return (data) => {
    let base = path.basename(name, ".tex")
    let relDir = path.dirname(data._current)
    let srcDir = path.join(data._srcDir, relDir)
    let dstDir = path.join(data._dstDir, relDir)
    let cmd

    cmd = `pdflatex -halt-on-error -output-directory ${tmpDir} ${srcDir}/${name}`
    console.log("Running", cmd)
    execSync(cmd)

    fs.mkdirSync(dstDir, {recursive: true})
    cmd = `pdftoppm -r 110 -png -singlefile ${tmpDir}/${base}.pdf ${dstDir}/${base}`
    console.log("Running", cmd)
    execSync(cmd)

    let url = mapUrl(path.join(relDir, base+".png"))
    return `<img src="${url}" />`
  }
}

module.exports = {
  srcLink,
  loadPgf,
}
