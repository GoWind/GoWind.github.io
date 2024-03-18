---
title: AVL Trees Part-2 Deletion
date: 2023-09-07
---


In [[AVL Trees - Part I]], we saw the need for AVL Trees and how we use the `balanceFactor` of a node to keep the tree balanced when inserting nodes. 

In a similar fashion, when deleting nodes, the Tree's balance can go out of whack. We therefore do the same rotation operations during deletion, to keep the tree balanced.

Whenever we delete a node/leaf, starting from its parent, all the way to the root, we check the balance of each node and rebalance it the balanceFactor > 1 or < -1 


We will go over the same 4 conditions described in Part 1 and see how to apply the operations during Deletion


1. LL (Left  Left)

```
       14                                              14
      /  \                                           /   \
     13   17        --delete(19)-->.               13     17
    /      \                                      /
   12       19                                   12
  /                                            /
10                                           10
```


We do a standard rightRotate(root) to balance this
```
          13
         /  \
        12  14
       /      \
      10       17

```

`balanceFactor` of the root is now `1.`

2. RR (Right Right)

```
        14                                    14
       /  \                                 /   \
      10    15         --delete(16)-->.   10      15
     /        \                                    \ 
    6         16                                    16
                \                                    \
                 17                                   17
```

We do a standard rotateLeft(root) to balance this 

```
       15
      /  \
     14   16
    /      \
   10       17
```

```
def leftRotate(n):
  right = n.right
  right_left = right.left
  new_root = right
  new_root.left = n
  n.right = right_left # since we changed n.right to root
  return new_root
```

The `leftRotate` turns out tree rooted at 14, to this:

```
```
      14                                 15
        \                               /    \
         15            ---->          14      16
            \                                     \
             16                                     17
               \
                17      
```
```



3. Left Right



```
          2418328867                                           
            /.    \                                                    
 2283235063       2441074453           ---delete(2441074453)--> 
       \             \
        2341175950   2452843659
        /
2319367546
```

when we delete a node, we replace it's position in the tree by its in-order successor, if it has any.
```
           . 2418328867                                           
            /.    \                                                    
 2283235063        2452843659     
       \            
        2341175950   
        /
2319367546
```

The balance factor of node rooted at key  `2418328867` is 2, we rebalance this using LR technique described in the insertion post.

LeftRotate(root.left)

```
           2418328867                                           
            /     \                                                    
       2341175950  2452843659     
        /    
2283235063 
       \
       2319367546
```

Followed by rightRotate(root)

```
		2341175950
		/.       \
	2283235063	2418328867
       \              \
       2319367546      2452843659
```



Right Left


```
               150265093
	          /       \
    1063987789         1718327935       --delete(406675537)-->
     /                /       \
406675537   1479316738       1957770709
            /        \.                
  1305025970          1480403904
```


```
               150265093
	          /       \
    1063987789         1718327935      
                       /       \
             1479316738       1957770709
            /        \.                
  1305025970          1480403904
```

the balanceFactor of the root is -2. So we rebalance this, by perfoming a RightLeft rotation. 

1. RotateRight(root.right)

```
               150265093
	          /       \
    1063987789         1479316738      
                       /       \
		 .   1305025970         1718327935
                              /      \
		            1480403904     1957770709
```

2. followed by rotateLeft(root)

```
			   1479316738
			/           \
		  150265093.      1718327935
		 /.     \              /       \
1063987789.    1305025970. 1480403904.  1957770709
```
