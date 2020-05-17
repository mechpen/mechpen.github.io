(function () {
	Prism.hooks.add('complete', function (env) {
		if (!env.code) {
			return
		}

		var code = env.element
		var pre = code.parentNode

		// works only for <code> wrapped inside <pre> (not inline)
		if (!pre || !/pre/i.test(pre.nodeName)) {
			return
		}

		// Abort if line numbers already exists
		if (code.querySelector('.line-numbers-row')) {
			return
		}

		var addLineNumbers = false
		var lineNumbersRegex = /(?:^|\s)line-numbers(?:\s|$)/

		for (var element = code; element; element = element.parentNode) {
			if (lineNumbersRegex.test(element.className)) {
				addLineNumbers = true
				break
			}
		}

		// only add line numbers if <code> or one of its ancestors has the `line-numbers` class
		if (!addLineNumbers) {
			return
		}

    lineNumberElem = '<span class="line-numbers-row"></span>'
    code.innerHTML = lineNumberElem + code.innerHTML.trim().replace(/\n/g, "\n"+lineNumberElem)
	})
}())
