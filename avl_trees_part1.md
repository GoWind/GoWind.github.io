### What problem does AVL Tree solve ? 

Imagine you have a Binary Search Tree implementation and you are inserting elements in ascending order

[11., 12, 13, 14, 15, 16, 17, 18]

Your Binary Search Tree would look like this 

```
11
  12
    13
      14
        15
          16
            17
              18 
```

Your tree effectively turns into a Linear list with O(n) access, instead of O(h) access where h ~ log2(n)

This is an **unbalanced** tree and the more unbalanced a tree is, the more avg. access is O(n) instead log2(n)

(Similarly, if we are turning a descending sorted array into a Binary Search Tree, we will run into the mirror image of the above tree)

AVL Trees are a **balanced** tree, where after very insertion and deletion, we **balance** the tree if it becomes unbalanced.

#####  By keeping a tree `balanced` , we are ensuring that access remains as close to O(n) as possible

#### How do we know a tree is unbalanced ? 

We use a value `balanceFactor` to determine if a node is balanced or not. 

Before we formulated `balanceFactor`, recall that :
The height of the tree is the distance from the node to the lowest leaf in its left or right subtree. 
The height of a leaf is `0`. `height(leaf) -> o`
The height of a `null` leaf is also 0. `height(null) -> 0`
Height of a node = `1 + max(height(node.left), height(node.right))`

`balanceFactor = height(left_subtree) - height(right_subtree)`
If the `balanceFactor` is < -1 or > 1 , then the tree is **unbalanced**. 




When we start with an empty tree, our tree is balanced. On every insert or delete, we insert/delete into the left or the right subtrees of a current node. 
The insertion/deletion disturbs the existing balance of our tree, so we perform a check for each node in our path from the root, until the leaf node we inserted, if the node is balanced. 
If any node is unbalanced, then we `rebalance` that node

```
insert/delete(node, val):
  if val < node.val:
	  node.left = insert/delete(node.left, val)
  else:
      node.right = insert/delete(node.right, val)
  balance = calculate_balance(node)
  if balance < -1 or balance > 1 :
	  # rebalance
```


#### How do we do rebalance ? 

There are 4 conditions that will cause rebalancing. We name them as 
Left Left
Left right
Right Right
Right Left

1. LL (Left  Left)

```
      14
    13
  12
10      
```

The `balanceFactor` of the root with key `14`, = height(left_subtree) - height(right_subtree)
height(left_subtree) = 2
height(right_subtree) = 0
`balanceFactor` > 1, so we rebalance.
Rebalancing this condition is done by a `rightRotate`. 

The `rightRotate` of a node `n` is as follows

```
def rightRotate(n):
  left = n.left
  left_right = left.right
  new_root = left
  new_root.right = n
  n.left = left_right # since we moved n -> left.right, left.right -> n.left
  return new_root
```

Our `unbalanced` node `n` becomes

```
     14                      13
    13        --->         12  14
  12                     10
10  
```

`balanceFactor` of the root is now `1.`

2. RR (Right Right)

```
      14
        15
          16
            17      
```

The `balanceFactor` of the root with key `14`, = height(left_subtree) - height(right_subtree)
height(left_subtree) = 0
height(right_subtree) = 2
`balanceFactor` < -1, so we rebalance.
Rebalancing this condition is done by a `leftRotate`. 

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

The next 2 conditions will need a combination of left and right rotates to rebalance.

3. Left Right

```
      18
      /
    13
      \
      14
        \
        16      
```

In this situation, a single right rotation wouldn't solve the problem. Why ? Lets try to do a simple LL fixup, which performs a `rotateRight(18)`

```
       18                                       13
      /                                          \
    13             -----> LL(18)                  18
      \                                          /
       14                                      14
        \                                       \
         16                                     16
```

`13` is the new root. `18` becomes 13's right. `left_right` from `rightRotate()` (14) become's `n.left` (18's left). `x` mark's `null` nodes

If we calculate the `balanceFactor` of 13, it is now `-2` instead of becoming 1. So doing a single `rightRotate` in this case isn't sufficient. 

Since our case is a LR (Left of root, then right of left), we do a `leftRotate` of `n.left`, followed by a `rightRotate` of n.

This will first turn LR -> LL, and then we can apply `rightRotate`

```
      18                              18                                14
     /    
    13
      \       --> leftRotate(13)    14    --> rightRotate(18) -->.  13.    18
       14                        13.  16                          x   x 16.  x
        16                       
```

We now have a balanced Tree. 

(We could have stopped after the leftRotate(13), the next insert of a value < 18 would have triggered a further rebalance. I think this is why the algorith now specifies an additional rightRotate of 18 so that we can insert a few more elements before have to rebalance)

4. RL (Right Left)
```
      18
        \
         29
         /
       27
       /
    22
```

Similar to LR, we cannot do just 1 rotation and fix this situation. Let us try to a simple leftRotate on 18 to see why

```
   18                                    29
     \                                  /
     29      --RR(18)->                18
   /                                     \   
  27                                      27
 /                                       /
22                                      22 
```   

Our `balanceFactor` for the root is now still -2. 

To solve this, we first do a `rotateRight(29)` and then follow it up with a `leftRotate(18)`

```
    18                            18                                    27
      \                             \                                 /   \ 
      29  rightRotate(29) ->         27        leftRotate(18) ->.   18    29
     /                              /  \                              \
   27                              22   29                            22
  /
22
```
