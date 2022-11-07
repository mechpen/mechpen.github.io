package main

func mainTest(a1 string, a2 []byte, a3 map[uint64]uint64) {}

func main() {
	str := "hello"
	sli := []byte(str)
	mp := map[uint64]uint64{
		0x11: 0x1111,
		0x22: 0x2222,
	}
	mainTest(str, sli, mp)
}
