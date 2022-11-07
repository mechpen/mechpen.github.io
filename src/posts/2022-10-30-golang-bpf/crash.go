package main

import (
	"time"
	"flag"
)

func recursion(level, maxLevel uint64) {
	if level > maxLevel {
		return
	}
	recursion(level+1, maxLevel)
}

func mainTest(maxLevel uint64) {
	recursion(0, maxLevel)
}

func main() {
	var maxLevel = flag.Uint64("l", 35, "max recursion level")
	flag.Parse()
	for {
		go mainTest(*maxLevel)
		time.Sleep(time.Second)
	}
}
