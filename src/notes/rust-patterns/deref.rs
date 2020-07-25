use std::ops::Deref;

struct CharContainer {
    value: char,
}

impl Deref for CharContainer {
    type Target = char;

    fn deref<'a>(&'a self) -> &'a char {
        &self.value
    }
}

fn foo(arg: &char) {}

impl<T, X> Encode for X where
	T: Encode + ?Sized,
	X: WrapperTypeEncode<Target = T>,
{
	fn encode(&self) -> Vec<u8> {
            // WH: the following also works
            // X::deref(self).encode()
            // (self as &T).encode()
	    // (**self).encode()
            //
            // If T implements Deref<Target = U>, and x is a value of type T, then:
            // *x on non-pointer types is equivalent to *Deref::deref(&x)
            //
            // *self is type X
            // **self is *X::deref(&*self) which is *X::deref(self)
            // &**self is X::deref(self)
            
		(&**self).encode()
	}
}

fn main() {
    let x = &mut CharContainer { value: 'y' };
    foo(x); //&mut CharContainer is coerced to &char.
}
