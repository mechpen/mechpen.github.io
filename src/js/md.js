const anchor = require('markdown-it-anchor')
const katex = require("markdown-it-katex")

const md = require("markdown-it")({
  html: true,
  linkify: true,
})
.use(anchor, {
  permalink: anchor.permalink.headerLink(),
})
.use(katex)

module.exports = md
