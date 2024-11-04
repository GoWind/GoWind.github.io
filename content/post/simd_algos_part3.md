---
title: "SIMD algos part III: Blending and Permutations"
date: 2024-11-04	
---

I wanted to the end the last post in this series, explaining the encoding part of the SIMD base64 solution, but while trying to write it down, it looked like it might be too large forr one single article. Also stuff going in my life has made time even dearer to me, thus cutting short the amount of time I could spend writing. We close out this article series on SIMD with 2 other interesting instructions : Blend and Permute


## Blend

Blend lets one blend the lanes of 2 registers, based on a control mask/control vector. 
The algorithm goes something like this: 

```
// blend byte lanes from a and b based on control
blend_epi8(__m256i a, __m256i b, __m256i control) {
  result = __mm256i();
  for(int i=0;i<32;i++) {
    if(control.lane[i] & 0x80) // highest bit of same lane in control is set
      result.lane[i] = b[i]
  } else {
    result.lane[i] = a[i]
  }
}
```

In lane i of the result, If the MSB of the control lane is 1, then we will use the value from b for lane i, else we use the value from lane i of a. 

This can be used for finding and replacing or removing a certain value from an array 
For example, here is a fn that replaces all the dots (ASCII code 45) with underscores (ASCII CODE 46). 
```
__m256i replaceDots(uint8_t* j) {|
  __m256i loadedValue = _mm256_loadu_si256( (__m256i*)j);|
  __m256i dots = _mm256_set1_epi8(46);|
  __m256i underscores = _mm256_set1_epi8(45);|
  __m256i mask = _mm256_cmpeq_epi8(loadedValue, dots);|
  __m256i result = _mm256_blendv_epi8(loadedValue, underscores, mask);
  return result;
  }

```

We first load a buffer into our register and then compare each of the byte against a dot (Decimal 46). The `_mm256_cmpeq_epi8` makes 32 comparisons at ones, setting a `1` in lane i in mask , if loadedValue[i] == 46, else sets a `0` in.

Now that we know which lanes are 46 in our source ( `1` in the mask, we simply mark those lanes as to be replaced with an undescore, and we do so with the blend intrinsic: `mm256_blendv_epi8(loadedValue, underscores, mask)`. If lane [i] of mask is 1, then we replace it with a value from underscores (which is just a register with all lanes set to the value 45), else we use the original value from our source register.

This example works only for an ASCII encoded buffer (as for the comparison and replacement to work right, all values in our input must be 1-byte values)


## Permute

Permute intrinsics / instructions allow you to swap /permute the lanes of the registers. Through a control mask again, you can do stuff like register.lane[10] = register.lane[11], register.lane[4] = register.lane[0] etc. 

While reading a paper, I [came across](https://users.cs.utah.edu/~regehr/minotaur-oopsla24.pdf) an interesting technique to find and replace characters in the reverse direction (which I split it into the 2 examples above and below). I thought, why not use SIMD to reverse an array of 32 characters ? 

Remember the `shuffle` intrinsics from the previous posts ? We can use shuffle to swap the order of elements in an input array in a different order. 


```
__m256i reverse(__m256i input) {
    __m256i reversed_indexes = _mm256_setr_epi8(
        15, 14, 13, 12, 
        11, 10, 9,8, 
        7, 6, 5, 4,
        3, 2, 1, 0,
        15, 14, 13, 12,
        11, 10, 9, 8,
        7, 6, 5, 4,
        3, 2, 1, 0);
    return _mm256_shuffle_epi8(input, reversed_indexes);
}

__m256i linear = _mm256_setr_epi8(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,|
 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31);
__m256i reversed = reverse(linear);
reversed = _mm256_permute2x128_si256(reversed, reversed, 0x01);
print_mm256i(reversed);
```

recall that shuffle does something like `value[i] = a[b[i]]` where `a` is `input` and `b` is our `reversed_indexes`.  I mapped index `0` -> `15`, `1` -> `14`... so that the shuffle efffectively reverses the elements order. But here is a catch: the above code only reverses the elements within one half of the 2 128-bit lanes of the 256-bit register. Why ? because shuffle on avx2 cannot shuffle across all the 32-lanes of the 256b. register. We can only shuffle values amongst the first 128b lane or the second 128b lane, but not across. 

So the solution is to reverse each lane by itself and then swap the order of the lanes in the register, something like this :

```
0 1 2 3 4 5 ......... 16 17 18 ... 30 31
Shuffle within lanes
15 14 13 12 11 10 ... 0 , 
Switch lanes using perumute
31 30 29 28 .... 17 16, 15 14 13 12 11 10 ... 0 
```

You can see the output of my code for reversing , the lines are before and after reversing the array.
```
__m256i: [0x03020100, 0x07060504, 0x0B0A0908, 0x0F0E0D0C, 0x13121110, 0x17161514, 0x1B1A1918, 0x1F1E1D1C, ]
__m256i: [0x1C1D1E1F, 0x18191A1B, 0x14151617, 0x10111213, 0x0C0D0E0F, 0x08090A0B, 0x04050607, 0x00010203, ]
```


### Where to go from here

All of the above instructions are just a small fraction of the features and capabilities of SIMD instruction sets. Be it NEON/SVE on ARM or AVX2/AVX-512 on x86_64, there are instructions that cater to trigonometric fns, complex number manipulation and other kinds of arithmetic/ logic instructions.  While one might try to read through the entire instruction set, I feel like that might be a big waste of time. Instead, it might be better to find out solved applications of SIMD where there is a concrete problem to solve and then learn how and which instructions were used. what I am trying to do is read through libraries like [simdutf](https://github.com/simdutf/simdutf), [simSIMD](https://github.com/ashvardanian/SimSIMD) , [simdjson](https://github.com/simdjson/simdjson) (simdjson for example, is well documented). These libraries solve problems in a specific context and have good documentation around them, making the process of learning how to use SIMD instructions less random and more structured. 
