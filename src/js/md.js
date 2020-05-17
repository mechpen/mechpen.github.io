const md = require("markdown-it")({
  html: true,
  linkify: true,
})
.use(require("markdown-it-anchor"), {
  permalink: true,
})
.use(require("markdown-it-katex"))

module.exports = md
