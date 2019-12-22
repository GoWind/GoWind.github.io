# Transducers - A Walkthrough

The idea of the article is to provide a walkthrough guide of sorts for understandig
a `transducer`  in Clojure. 

You can play with the code mentioned below by downloading this [file](https://gist.github.com/GoWind/24256bd633392bd9e70dcb30af62de10) and executing the code in the REPL.


```
(ns transducertutorial.core)
```

;; A Reducing function is one that takes
;; an accumulator and an item
;; and returns a new accumulator with the item processed
```
(defn my-reducing-fn
  [accumulator item]
  (conj accumulator item))
```

;; `conj` is smart enough to know how to how to add the item to the
;; accumulator
;; even conj is a reducing-fn

;; How do we use something like conj to implement map and filter ?
;; Via `reduce`. Reduce takes a reducing fn., an accumulator and a
;; the collection that must be reduced.

```
(reduce (fn [acc item] (conj acc item)) [] [1 2 3 4 5])
```
;; We can implement map and filter via reduce

```
(defn map-via-reduce
  [mapping-fn coll]
  (reduce (fn [acc item] (conj acc (mapping-fn item))) [] coll))
```

```
(defn filter-via-reduce
  [filter-fn coll]
  (reduce (fn [acc item] (if (filter-fn item) (conj acc item) acc) [] coll)))
```

;; There are 3 tight **"couplings"**
;; a) We use conj to add item to the accumulator
;; b) We use an empty vector [] as the collection
;;      for reduction
;; c) If we want to compose our map and filter fns, we can pass the output
;;     of one to the other. While doing so we are creating a new collection after
;;     each map or reduce, which can be very expensive in terms of memory and
;;     computation time


;; Ideally we would a composition of map and filter to look like 
```
(defn map-fn [item] (inc item))
(defn filter-fn [item] (some? item))
(reduce (fn [acc item] (if (filter-fn item) (conj acc (map-fn item)) acc)) [] [1 2 3 4 5])
```

**I would say that this, perhaps is the core idea behind transducers,
behing able to compose our input processing functions in such a way
that they are run only once for each item**


;; Lets make a couple of small changes to a reducing function
;; by adding an arity-0 and an arity-1 variation to it
```
(defn my-rf
  ([] [])
  ([result] result)
  ([result input] (conj result input)))
```

;; Our reducing fn can now
;; a. create a new `collection, if called with no args
;; b. if not provided an `item` but only with a collection, pass the collection on
;; c. when it gets a `collection` and an `item` knows how to add the `item` to
;; the `collection`.

;; Let us also create a more "fun" version of a multi-arity
;; reducing fn.

```
(defn str-rf
  ([] "")
  ([a-string] a-string)
  ([a-string a-input] (str a-string a-input)))
```

;; we now make tweak map and filter to make them a transducer, a.k.a transforming reducer
;; Map and filter accept a fn as usual, but instead of accepting
;; a mapping fn and a collection,
;; we also have a version where

```
(defn my-map
  ([f]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] result)
       ([result input] (rf result (f input))))))
  ;; The traditional map version
  ;; There are more arities that accept 2,3 and n colls
  ;; but I have left them out for the sake of clarity
  ([f coll]
   (map f coll)))
```

```
(defn my-filter
  [f]
  (fn [rf]
    (fn
      ([] (rf))
      ([result] result)
      ([result input] (if (f input)
                        (rf result input)
                        result)))))
```

;; Order of applying fns is left -> right (even? is applied first before inc)
```
(transduce (comp (my-filter even?) (my-map inc)) my-rf [10 12 14]) ;; [11 13 15]
```
```
(transduce (comp (my-filter even?) (my-map inc)) my-rf [10 12 14]) ;; []
```

;; What is happening here ?
;; what transduce does internally is ((comp (my-filter even?) (my-map inc)) my-rf)
;; which translates to something like
```
(comment
  (let [inc-mapped     (my-map inc)
        inc-with-rf    (inc-mapped my-rf)
        even-filter    (my-filter even?)
        even-filter-rf (even-filter inc-with-rf)]
    even-filter-rf))
```

;; What even-filter-rf will do when when it gets an accumulator
;; and an input is something akin to
;; `(fn [acc input] (if (even? input) (inc-with-rf acc input) acc))`
;; Notice that inc-with-rf is exactly of the same format.
;; Here, replace the `(if (even? input) ..)` with `(my-rf acc (inc input)`

;; lets use our str-rf to see how it works
```
(transduce (comp (my-filter even?) (my-map inc)) str-rf [10 12 14])
```


;; We have solved 2 problems so far.
;; 1. Decouple the creation of the output collection by letting the
;;    reducing fn take care of that
;; 2. Ensuring that the composition of our filter and map is run only once
;;    for each item in our collection

;; There is one more problem: how do we iterate over the input collection?
;; Enter protocols to the rescue
;; Collections implement clojure.lang.IReduceInit
;; or          implement clojure.core.protocols/coll-reduce
;; All collections that implement IReduceInit know how to take
;; a. An accumulator
;; b. A reducing fn
;; And reduce themselves using the reducing fn and the accumulator
;; The same goes for coll-reduce
;; We thus solved the problem of iterating (folding) over the collection by letting the
;; collection do it for us.

;; There is also an interesting property of the built-in reduce.
;; A value can be marked `reduced`, in which case, reduce will simply
;; return the reduced value as the result of the reduce (fold) on the collection

```
(reduce (fn [acc v] (if (= v 5) (reduced 5) (conj acc v))) []  [1 2 3 4])
(reduce (fn [acc v] (if (= v 5) (reduced 5) (conj acc v))) []  [1 2 3 4 5])
```

;; You can use `reduced` to indicate that you no longer want to process a collection further
;; and terminate the fold with the `reduced` value.

;; This is useful if you want to for example, process the collection until you find the
;; item x, or process the first n items in a collection.

;; `take-while` takes a fn f and processes the collection, until (f item) returns false
;; and returns the folded value so far.
;; Let us implement our `take-while`

```
(defn my-take-while
  [f]
  (fn [rf]
    (fn
      ([] (rf))
      ([result] result)
      ([result input] (if (f input)
                        (rf result input)
                        (reduced result))))))
```

```
(transduce (comp (map inc) (my-take-while (fn [n] (< n 50)))) conj [10 44 56 63 2])
;; => [11 45]
```

;; There are also transducers that can do stateful transformations.
;; One such transformer is `take`

```
(defn take
  [n]
  (fn [rf]
    ;; clojure.core/take uses a volatile! which is out of scope for this
    ;; article
    (let [counter (atom n)]
      (fn
        ([] (rf))
        ([result] result)
        ([result input]
         (let [v @counter
               nn (swap! counter dec)]
           (if (pos? v)
             (rf result input)
             (reduced result))))))))
```

```
(transduce (comp (map inc) (take 5)) conj (range 1 1000))
```

