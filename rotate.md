# Google Code Jam practice problem - Rotate
## Problem definition is [here](http://code.google.com/codejam/contest/544101/dashboard#s=p0)
In this problem, you are given a board of tiles named 'R' or 'B' or blank('.'). Given a NxN tile
you need to find if any or both of the players have K tiles lined up horizontally or vertically or diagonally. You can however rotate the board by 90 degrees clockwise, allowing pieces to fall due to gravity and then check for winners. 

The following code solves the problem in Python. To check for winners. We use the following trick.
A matrix is created for tracking player 'R'. For each position in the board, we track the number of preceding 'R's in the horizontal, vertical and diagonal directions. If there are continuous 'R's the position of the 'R' in the current direction is encoded else it is left as 0. for eg, in the sequence 'RRRR' in the first row, the value for the third R is (0,3,0) indicating 3rd R in diagonal,horizontal and vertical directions respectively. If for any cell any of the values reaches K, then the player has won.

```
def read_board(m):
	""" Read m line from stdin
		and process them into a board
	"""
	board = [ raw_input().split() for i in range(m) ]
	return board

def rotate(board):
	""" Rotates a board by 90deg clockwise
	"""
	n = len(board)
	for i in range(n):
		space = 0
		for j in range(n-1,-1,-1):
			if board[i][j] == '.':
				space = space+1
			else:
				if space > 0:
					for u in range(j,-1,-1):
						board[i][u+space] = board[i][u]
						board[i][u] = '.'
					space = 0
				else:
					continue
	return board


def wins(board,p1,p2,k):
	""" Returns a tuple of (res,res) for p1 and p2
		res = 1 => wins
			= 0 => loses
	"""
	p1wins = 0
	p2wins = 0
	n = len(board)
	trackr = [ [(0,0,0)]*(n+1) for i in range(n+1) ]
	trackb = [ [(0,0,0)]*(n+1) for i in range(n+1) ]
	for i in range(1,n+1):
		for j in range(1,n+1):
			if not p1wins:
				a,b,c = 0,0,0
				a = 0 if board[i-1][j-1] != p1 else trackr[i-1][j-1][0]+1
				b = 0 if board[i-1][j-1] != p1 else trackr[i][j-1][1]+1
				c = 0 if board[i-1][j-1] != p1 else trackr[i-1][j][2]+1
				trackr[i][j] = (a,b,c)
				if a == k or b == k or c == k:
					p1wins = 1
			if not p2wins:
				d, e, f = 0,0,0
				d = 0 if board[i-1][j-1] != p2 else trackb[i-1][j-1][0]+1
				e = 0 if board[i-1][j-1] != p2 else trackb[i][j-1][1]+1
				f = 0 if board[i-1][j-1] != p2 else trackb[i-1][j][2]+1
				trackb[i][j] = (d,e,f)
				if d == k or e == k or f == k:
					p2wins = 1
	return (p1wins,p2wins)
```
