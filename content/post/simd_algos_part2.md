---
title: "SIMD algos part II: popcount"
date: 2024-10-24
---
# Hamming Weight or Popcount

A very popular task in Computing is counting the number of ones in a byte or a set of bites.
This task is called [Hamming Weight](https://en.wikipedia.org/wiki/Hamming_weight) or population count or more simply, popcount. Popcount is a popular enough instruction that most CPUs provide hardware instructions instead of relying on software routines. x86-64 provides a `popcnt` instruction that calculate the number of set bits in the source operand 64-bit register. ARM has a `CNT` instruction that calculates the number of set bits in the source 128-bit SIMD register. 

You can access the popcount instruction using the `__builtin_popcount` fn in GCC (or Clang). GCC supports [builtin functions](https://gcc.gnu.org/onlinedocs/gcc/Other-Builtins.html) , functions that extend features in C or provide optimized implementations of fns in the C standard library. The builtin might or might not use a hardware provided instruction to implement `popcount`

The [Hamming Weight Repository](https://github.com/CountOnes/hamming_weight) has a number of different implementations of popcount for both 32/64-bit values and SIMD accelerated versions to calculate the number of set bits in an array of 64-bit unsigned integers, each integer holding 64 counts (1/0). 
I ran the benchmarks on a Core i5-10210U processor and , While the fastest implementation is  `avx2_harley_seal_bitset64_weight_unrolled_twice`, I modified the `avx2_bitset64_weight`implementation so that is easier to understand while still faster than the scalar popcount version that calculates popcount for an array of values in a loop, something like 

```
for(int i=0;i<N;i++) {
  totalCount += popcount(a[i]);
}
```

My implementation is a bit interesting. I assumed that eliminating the inner loop from the `avx2_bitset64_weight` would make my implementation faster, but surprise ! It actually ended up running ~20% slower THAN the one with an inner loop ! How come ? Did the inner loop get unrolled ? Or is the additional instruction that I used so much slower that the overhead of a second loop was lower than it ? I don't know yet, perhaps someday I will get good enough with perf observations and microarchitectures to make a hypothesis and prove it. But for now, we can continue using my implementation to understand SIMD instructions while still not being slow.



```
size = 12288 words or 98304 bytes 
lauradoux_bitset64_weight(prec, size)                       	:  1.89 cycles per operation (best) 	1.95 cycles per operation (avg) 
scalar_bitset64_weight(prec, size)                          	:  2.67 cycles per operation (best) 	2.77 cycles per operation (avg) 
scalar_harley_seal8_bitset64_weight(prec, size)             	:  1.43 cycles per operation (best) 	1.47 cycles per operation (avg) 
scalar_harley_seal_bitset64_weight(prec, size)              	:  1.31 cycles per operation (best) 	1.32 cycles per operation (avg) 
table_bitset8_weight((uint8_t *)prec, size * 8)             	:  4.75 cycles per operation (best) 	4.76 cycles per operation (avg) 
table_bitset16_weight((uint16_t *)prec, size * 4)           	:  3.14 cycles per operation (best) 	3.21 cycles per operation (avg) 
....
sse_harley_seal_bitset64_weight(prec, size)                 	:  0.64 cycles per operation (best) 	0.64 cycles per operation (avg) 
avx2_bitset64_weight(prec, size)                            	:  0.38 cycles per operation (best) 	0.39 cycles per operation (avg) 
gov_avx2_bitset64_weight(prec, size)                        	:  0.48 cycles per operation (best) 	0.48 cycles per operation (avg) 
avx2_lookup_bitset64_weight(prec, size)                     	:  0.38 cycles per operation (best) 	0.39 cycles per operation (avg) 
avx2_lookup2_bitset64_weight(prec, size)                    	:  0.39 cycles per operation (best) 	0.40 cycles per operation (avg) 
avx2_lauradoux_bitset64_weight(prec, size)                  	:  0.48 cycles per operation (best) 	0.50 cycles per operation (avg) 
.....
avx2_harley_seal_nate_bitset64_weight(prec, size)           	:  0.32 cycles per operation (best) 	0.33 cycles per operation (avg) 
avx2_harley_seal_walisch_bitset64_weight(prec, size)        	:  0.34 cycles per operation (best) 	0.35 cycles per operation (avg) 
avx2_harley_seal_bitset64_weight_unrolled_twice(prec, size) 	:  0.30 cycles per operation (best) 	0.31 cycles per operation (avg) 
no AVX512 instructions
no XOP instructions

Output of running the benchmarks with my implementation. While having no nested loop like avx2_bitset64_weight, it still ended up being roughly 20-25% slower per cycle than the avx2_bitset64_weight fn
```

The [implementation](https://github.com/CountOnes/hamming_weight/blob/master/src/avx_hamming_weight.c) is the following snippet (**NOTE**: the snippet below is a modified version of the one in the repository)

```
// compute the Hamming weight of an array of 64-bit words using AVX2 instructions
int gov_avx2_bitset64_weight(const uint64_t * array, size_t length) {
    if(length < 4) {
      int leftover = 0;
      for(size_t k = 0; k < length; ++k) {
        leftover += _mm_popcnt_u64(array[k]);
      }
      return leftover;
    }
    uint64_t* next = array;
    int outer = length / 4;
    // these are precomputed hamming weights (weight(0), weight(1)...)
    const __m256i shuf =
        _mm256_setr_epi8(0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4, 0, 1,
                         1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4);
    const __m256i mask = _mm256_set1_epi8(0x0f);  // low 4 bits of each byte
    __m256i zero = _mm256_setzero_si256();
    __m256i total = _mm256_setzero_si256();
    for (int k = 0; k < outer; k++) {
        next = array + (k * 4);
        __m256i innertotal = _mm256_setzero_si256();
        __m256i ymm1 =
          _mm256_lddqu_si256((const __m256i *)next);
        __m256i ymm2 =
          _mm256_srli_epi32(ymm1, 4);  // shift right, shiftingin zeroes
        ymm1 = _mm256_and_si256(ymm1, mask);  // contains even 4 bits
        ymm2 = _mm256_and_si256(ymm2, mask);  // contains odd 4 bits
        ymm1 = _mm256_shuffle_epi8(
            shuf, ymm1);  // use table look-up to sum the 4 bits
        ymm2 = _mm256_shuffle_epi8(shuf, ymm2);
        innertotal = _mm256_add_epi8(innertotal, ymm1);  // inner total
        innertotal = _mm256_add_epi8(innertotal, ymm2);  // inner total
        innertotal = _mm256_sad_epu8(zero, innertotal);  // produces 4 64-bit
        total = _mm256_add_epi64(total, innertotal);

    }
    const int leftoverwords =  length % 4;
    int leftover = 0;
    for(size_t k = length - leftoverwords; k < length; ++k) {
      leftover += _mm_popcnt_u64(array[k]);
    }
    return leftover + _mm256_extract_epi64(total, 0) +    _mm256_extract_epi64(total, 1) +
           _mm256_extract_epi64(total, 2) + _mm256_extract_epi64(total, 3);
}
```

The leftover portion deals with 2 cases:
1. When the total number of bits in the array is < 256. In that case, just use the scalary version
2. When the array size is not a multiple of 8 64-bit ints. In this case, the last  N % 8 bits are processed serially. 

The remaining N / 8 bytes are handled in a SIMD accelerated loop. I shall try to illustrate the algorithm using a real example for an array of inputs

as input, lets use
```
  uint64_t a[61] = {[0 ... 60] = 0xFEAA0088};
```

There are 13 set bits in `0xFEAA0088`. An array of 61 values must therefore yield us 13 * 61 = 793. 

I do not want to focus on the entire body of the fn, but only on the loop `for (int k = 0; k < outer; k++) {`. The rest as mentioned is just dealing with the leftovers array_size % 32 bytes serially.

The value `shuf` is quite clever. It stores a pre-computed array of values, where the index is a number between 0-15 (that is 0x0 - 0xF) and the value is the number of bits in the index (shuf[16 / 0xF] = 3). Thus, in each iteration, we can split our input 256 bits into 64, 4-bit values and simply loop over the count of `1`s in each of the 4-bit values to get the final tally of `1`s ! Quite clever eh ?
There is one more very clever optimization: Normally arrays are stored in the memory as a continuous set of bytes : `a[0], a[1], a[2]`. When fetching a memory location `a[n]`, if the value is not in the CPU's cache, it must be fetched from the main memory, thus stalling the instruction and slowing performance. However, shuf is **NOT** an array, but a single 256-bit register value. This means that to do a lookup of `1s` in a 4 bit value, no Cache/Memory lookup is needed as the entire array fits into a single register and we can lookup the hamming weight of a 4-bit value using just a shuffle SIMD instruction ! 

To calculate the number of `1`s , we split our input 256 bits into 4-bits each  first and this is how we do it:

```
   __m256i ymm1 =
          _mm256_lddqu_si256((const __m256i *)next);
        __m256i ymm2 =
          _mm256_srli_epi32(ymm1, 4);  // shift right, shiftingin zeroes
        ymm1 = _mm256_and_si256(ymm1, mask);  // contains even 4 bits
        ymm2 = _mm256_and_si256(ymm2, mask);  // contains odd 4 bits
     
```

`ymm1` has the 256 bits under consideration. We then load `ymm2`  with `ymm1`, butwhere each 32-bit lane is right shifted by 0 4 times.
Given our example array above, `ymmm1` would look something like
```
[0xFEAA0088 00000000 0xFEAA0088 00000000 0xFEAA0088 00000000 0xFEAA0088 00000000]
```
(Intel is little-endian so a 64-bit integer representing `0xFEAA0088` is `0x00000000FEAA0088` and the Least Significant Bytes are stored in the first memory address followed by the second and so on)
Shifted right by 4 bits in each 32-bit lane, we get ymm2
```
[0x0FEAA008 00000000 0x0FEAA008 00000000 0x0FEAA008 00000000 0x0FEAA008 00000000]
```

If I `and` both `ymm1` and `ymm2` with a mask register of repeated `0x0F` values

```
[0x0FEAA008 00000000 0x0FEAA008 00000000 0x0FEAA008 00000000 0x0FEAA008 00000000]
&&
[0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F 0x0F0F0F0F]
```

essentially I endup with 2 all the even 4-bits in ymm1 and the odd 4-bits in ymm2. 

```ymm2 after AND with mask
[0x0F0A0008 00000000 0x0F0A0008 0x00000000 0x0F0A0008 0x00000000 0x0F0A0008 0x00000000]
```

In both `ymm1` and `ymm2` we only select 4-bits out of each 8-bit lane from the input. This means that the higher 4-bits of each 8-bit lane is 0, thus each 8-bit lane has a value [0..15]. Using the `shuffle` intrinsic, we can lookup number of `1`s in each 8-bit lane from `shuf` register

```
ymm2 = _mm256_shuffle_epi8(shuf, ymm2)
// this is akin to doing
for(int i = 0; i < 32;i++) {
 ymm2[i] = shuf[ymm2[i]];
}
```

We do not have to worry about overflowing because all the values in shuf are < 16
After the `shuffle` intrinsice, `ymm1` will contain the number of `1`s in the even 4-bits and `ymm2` will contain the number of `1`s in the odd 4-bits. We then add them lane-wise to a running counter `innertotal`
```
innertotal = _mm256_add_epi8(innertotal, ymm1);  // inner total
innertotal = _mm256_add_epi8(innertotal, ymm2);  // inner total
```
We do not have to worry about overflows here as well, as the max value in each 8-bit lane is 32 (16 + 16).

Our final count will be the sum of all of the 8-bit lanes in `innertotal`.
```
total = 0;
for(int i=0;i<32;i++) { total += register[lane_i];}
```
Unfortunately, there is no intrinsic in avx2 to do this operation, so we employ a little trick using the `_mm256_sad_epu8` or the Sum Absolute Differences intrinsic

```
innertotal = _mm256_sad_epu8(zero, innertotal);  // produces 4 64-bit
total = _mm256_add_epi64(total, innertotal);
```

the `sad_epu8` intrinsic, subtracts each 8-bit lane from register b (innertotal) from register a (zero), takes the absolute of the value and adds them with the value from the other lanes. 

it emits 4 64-bit values containing the sum of 8, 8-bit lanes. To make this easier to understand here is the output of the previous 2 intrinsics
```
innertotal: [0x07040002, 0x00000000, 0x07040002, 0x00000000, 0x07040002, 0x00000000, 0x07040002, 0x00000000, ]
total: [0x0000000D, 0x00000000, 0x0000000D, 0x00000000, 0x0000000D, 0x00000000, 0x0000000D, 0x00000000, ]
```

The first 64-bit lane in `total` contains the value 0xD (or decimal 13), which is the sum of the first 8 8 bit lanes in `innertotal`. This incidentally is also number of `1`s in each of the elements in the input array ! 

Once the loops are processed, we process any leftover values
```
const int leftoverwords =  length % 4;
int leftover = 0;
for(size_t k = length - leftoverwords; k < length; ++k) {
      leftover += _mm_popcnt_u64(array[k]);
}
```

Since our total is a vector register and we are returning a single 64-bit value, we must extract each 64-bit value from our `total` register. We can do that using `__mm256_extract_epi64(register, lane)` to extract the 64-bit value in `lane`.

```
return leftover + _mm256_extract_epi64(total, 0) + _mm256_extract_epi64(total, 1) 
+ _mm256_extract_epi64(total, 2) + _mm256_extract_epi64(total, 3);
```


Using SIMD , we thus process 256-bits in a go instead of 64-bits in each iteration using `      _mm_popcnt_u64(array[k])`, with potentially upto 4x the speed up (in reality, due to loop overhead and multiple instructions per loop iteration, the speed is 2x or less)


### Conclusion

We used SIMD to solve a problem with real world applications and not just as a contrived example. I was very surprised by the fact that my fn with no inner loop ended up being slower than one with 2 loops. Clearly O(n^2) must be slower than O(n) right ? 
I still have no idea how this happened , but I speculate that with all the optimization flags turned on, the compiler decided to unroll the innerloop thus avoiding the overhead of the loop, or am I getting slowed down due to microarchitecture issues ? I will continue investigating this and hopefully in the future have an answer.

