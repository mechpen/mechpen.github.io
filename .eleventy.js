const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const sass = require("sass")

module.exports = function(eleventyConfig) {
  var config = {
    dir: {
      input: "src",
      includes: "includes",
      layouts: "layouts",
      data: "data",
      output: "dist",
    },
    templateFormats: [
      "md",
      "html",
      "css",
      "png",
      "pdf",
    ],
  }

  var md = require("markdown-it")({
    html: true,
  })
  .use(require('markdown-it-anchor'), {
    level: 1,
    permalink: true,
  })
  .use(require('markdown-it-prism'))
  eleventyConfig.setLibrary("md", md)

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
    return {
      parse: function(token) {
        this.name = token.args
      },
      render: function(scope) {
        return sass.renderSync({file: findFile(this.name, scope)}).css
      },
    }
  })

  eleventyConfig.addLiquidTag("loadPgf", function() {
    return {
      parse: function(token) {
        this.name = token.args
      },
      render: function(scope) {
        var srcFile = findFile(this.name, scope)
        var srcDir = path.dirname(srcFile)
        var cmd = ""

        cmd = "latex -halt-on-error -output-directory"
            + " " + srcDir + " " + srcFile
        console.log("Running", cmd)
        execSync(cmd)

        cmd = "dvisvgm -s " + srcFile.replace(/tex$/, "dvi")
        console.log("Running", cmd)
        var svg = execSync(cmd)
        return '<div class="img">' + svg + '</div>'
      },
    }
  })

  return config
}
