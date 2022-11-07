// Compile with the following command to disable auto inline:
//
//   go build -gcflags -l example.go

package main

import "time"

type SmallStruct struct {
	x1 uint64
	x2 uint64
	x3 uint64
	x4 uint64
}

type LargeStruct struct {
	x1 uint64
	x2 uint64
	x3 uint64
	x4 uint64
	x5 uint64
}

func fewArgsTest(a1, a2, a3, a4 uint64) (uint64, uint64, uint64, uint64) {
	return a1+0x11, a2+0x22, a3+0x33, a4+0x44
}

func manyArgsTest(a1, a2, a3, a4, a5, a6, a7, a8, a9, aA, aB, aC uint64) (uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64) {
	return a1+0x11, a2+0x22, a3+0x33, a4+0x44, a5+0x55, a6+0x66, a7+0x77, a8+0x88, a9+0x99, aA+0xAA, aB+0xBB, aC+0xCC
}

func smallStructArgTest(s SmallStruct) SmallStruct {
	s.x1 += 0x11
	s.x2 += 0x22
	s.x3 += 0x33
	s.x4 += 0x44
	return s
}

func largeStructArgTest(s LargeStruct) LargeStruct {
	s.x1 += 0x11
	s.x2 += 0x22
	s.x3 += 0x33
	s.x4 += 0x44
	s.x5 += 0x55
	return s
}

func mainTest() {
	fewArgsTest(1, 2, 3, 4)
	manyArgsTest(1, 2, 3, 4, 5, 6, 7, 8, 9, 0xA, 0xB, 0xC)

	var small SmallStruct
	smallStructArgTest(small)

	var large LargeStruct
	largeStructArgTest(large)
}

func main() {
	for {
		mainTest()
		time.Sleep(time.Second)
	}
}
