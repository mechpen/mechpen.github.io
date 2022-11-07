window.Prism = {
  manual: true,
}

require("prismjs")
require("prismjs/components/prism-c")
require("prismjs/components/prism-rust")
require("prismjs/components/prism-go")
require("./prism-line-numbers")

Prism.highlightAll()
