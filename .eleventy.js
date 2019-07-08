const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const util = require("util")
const sass = require("sass")

module.exports = function(eleventyConfig) {
  var config = {
    dir: {
      input: "src",
      includes: "includes",
      layouts: "layouts",
      data: "data",
      output: "dist",
    }
  }

  eleventyConfig.addPassthroughCopy("src/assets")

  var findFile = function(name, scope) {
    var inputPath = scope.contexts[0].page.inputPath
    file = path.join(path.dirname(inputPath), name)
    try {
      fs.statSync(file)
      return file
    } catch {
      return path.join(config.dir.input, config.dir.includes, name)
    }
  }

  eleventyConfig.addLiquidTag("loadScss", function() {
    var name

    return {
      parse: function(token) {
        name = token.args
      },
      render: function(scope) {
        return sass.renderSync({file: findFile(name, scope)}).css
      },
    }
  })

  eleventyConfig.addLiquidTag("loadPgf", function() {
    var name

    return {
      parse: function(token) {
        name = token.args
      },
      render: function(scope) {
        var srcFile = findFile(name, scope)
        var srcDir = path.dirname(srcFile)
        execSync("latex -halt-on-error -output-directory " + srcDir + " " + srcFile)
        return execSync("dvisvgm -s " + srcFile.replace(/tex$/, "dvi"))
      },
    }
  })

  return config
}
