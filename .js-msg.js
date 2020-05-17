const md = require("./src/js/md")
const dom = require("./src/js/dom")
const liquidTags = require("./src/js/liquidTags")

module.exports = (config) => {
  config.addLiquidTag("srcLink", liquidTags.srcLink)
  config.addLiquidTag("loadPgf", liquidTags.loadPgf)
  config.processors.exts[".md"] = (content, data) => md.render(content)

  let oldpost = config.processors.post
  config.processors.post = async (content, data) => {
    return await oldpost(await dom.process(content, data), data)
  }
}
