import {TILE_TYPE} from './tileType'
import { EventHandler } from './eventHandler'
import { chessNameToCoord } from './chessHelper'
export class ChessGame{
	board = []
	onMoveTaken = new EventHandler()
	onBoardUpdated = new EventHandler()
	settings= {
		size:8,
		whiteBottom:false,
		playingAs:null,
		movesDone:0
	}
	enPassantPawn
	/** List of all pieces of the dark player */
	darkPieces = []
	/** List of all pieces of the light player */
	lightPieces = []

	constructor(){
		this.board = this._generateBoard()
	}

	start({playingWhite}){
		this.settings.playingAs = playingWhite? TILE_TYPE.PLAYER_WHITE: TILE_TYPE.PLAYER_BLACK
		this.settings.movesDone = 0
	}
  /** Syncs a move from the opponent */
	syncMove({from,to}){
		return this._move({from,to})
	}
	move({from,to}){
		let fromCoord = chessNameToCoord(from)
		let fromPiece = this.board[fromCoord[1]][fromCoord[0]] & TILE_TYPE.PIECE_PLAYER
		let fromPlayerColor = fromPiece & TILE_TYPE.PLAYERS

		if(fromPlayerColor !== this.settings.playingAs){
			console.warn("you may not move those pieces!")
			return
		}

		let evenOrUneven = this.settings.playingAs === TILE_TYPE.PLAYER_WHITE? 0 : 1
		if(this.settings.movesDone % 2 !== evenOrUneven){
			console.warn("It's not your turn!")
			return
		}

		return this._move({from,to})
	}

	_move({from,to}){
		console.debug("move", from, to)
		let fromCoord = chessNameToCoord(from)
		let toCoord = chessNameToCoord(to)

		let fromPiece = this.board[fromCoord[1]][fromCoord[0]] & TILE_TYPE.PIECE_PLAYER
		let fromPlayerColor = fromPiece & TILE_TYPE.PLAYERS

		let possibleMoves = this.getPossibleMoves({board:this.board, piece:fromPiece, location:fromCoord})

		/** check if the intended move is possible */
		let movesFromPossible = possibleMoves.filter(m=>m[0] === toCoord[0] && m[1] === toCoord[1])

		if(movesFromPossible.length === 0){
			console.debug(`This move from ${from} to ${to} is not possible!`)
			return
		}
		else{
			let updatedTiles = [fromCoord, toCoord]
			/** remove piece piece from tile */
			let enemyPiece = this.board[toCoord[1]][toCoord[0]] & TILE_TYPE.PIECE_PLAYER
			this.board[fromCoord[1]][fromCoord[0]] &= ~(TILE_TYPE.PIECE_PLAYER|TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE)
			this.board[toCoord[1]][toCoord[0]]     &= ~(TILE_TYPE.PIECE_PLAYER|TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE)
			fromPiece &= ~TILE_TYPE.HAS_NOT_MOVED

			/** At the third index potential special state can be stored, like queen promote or en passant, so do this custom logic */
			if(movesFromPossible[0].length > 2){
				updatedTiles.push(...this._handleSpecialMoves(this.board, fromCoord, movesFromPossible[0], fromPiece, enemyPiece))
			}
			else{
				this.board[toCoord[1]][toCoord[0]] |= fromPiece
				updatedTiles.push(fromCoord, toCoord)
			}

			this.onBoardUpdated.trigger({updatedTiles})
		}
		
		this.onMoveTaken.trigger({from:from, to:to, player:fromPlayerColor})
		this.settings.movesDone++
	}

	*_handleSpecialMoves(board, fromCoord, toCoord, fromPiece, enemyPiece){
		let specialData = toCoord[2]
		
		if(specialData === TILE_TYPE.ROCKADE){
			let kingX, castleX
			if(toCoord[0] > fromCoord[0]){ //right
				castleX = fromCoord[0] + 1
				kingX = fromCoord[0] + 2
			}
			else{ //left
				castleX = fromCoord[0] - 1
				kingX = fromCoord[0] - 2
			}
			
			board[toCoord[1]][castleX] |= enemyPiece & ~TILE_TYPE.HAS_NOT_MOVED
			board[toCoord[1]]  [kingX] |= fromPiece
			yield [castleX, toCoord[1]]
			yield [kingX, toCoord[1]]
			
			//remove the castle from previous position
			board[toCoord[1]][toCoord[0]] &= ~TILE_TYPE.PIECE_PLAYER
		}
		else if(specialData === TILE_TYPE.EN_PASSANT){
			//TODO: remove en passant status after turn is over, because it is only possible directly after the move
			board[toCoord[1]][toCoord[0]] |= fromPiece
			let attackedPiece = toCoord[3]

			board[attackedPiece[1]][attackedPiece[0]] &= ~TILE_TYPE.PIECE_PLAYER
			yield attackedPiece
		}
		else if(specialData === TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE){
			this.enPassantPawn = toCoord
			board[toCoord[1]][toCoord[0]] |= fromPiece | TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE
		}
		else if(specialData === TILE_TYPE.PROMOTE){
			/** e.g. queen promote */
			fromPiece &= ~TILE_TYPE.PAWN
			fromPiece |= TILE_TYPE.QUEEN
			board[toCoord[1]][toCoord[0]] |= fromPiece
		}
		this.board = board
	}

	//#region private methods
	_generateBoard(){
		let bottomPlayer = (this.settings.whiteBottom)? TILE_TYPE.PLAYER_WHITE: TILE_TYPE.PLAYER_BLACK
		let topPlayer = (!this.settings.whiteBottom)? TILE_TYPE.PLAYER_WHITE: TILE_TYPE.PLAYER_BLACK

		let tiles = []

		this.lightPieces = []
		this.darkPieces = []
		for(let y = 0; y < 8; y++){
			let row = []
			for(let x = 0; x < 8; x++){		
				let tileContent = 0
			  tileContent |= (((y%2) + (x%2)) === 1? TILE_TYPE.BLACK_TILE: TILE_TYPE.WHITE_TILE)

			  if(y === 0){
					if(x === 0 || x === 8-1) tileContent |= TILE_TYPE.CASTLE|TILE_TYPE.HAS_NOT_MOVED
					if(x === 1 || x === 8-2) tileContent |= TILE_TYPE.ROOK
					if(x === 2 || x === 8-3) tileContent |= TILE_TYPE.BISHOP
					if(x === 3) tileContent |= TILE_TYPE.QUEEN
					if(x === 4) tileContent |= TILE_TYPE.KING|TILE_TYPE.HAS_NOT_MOVED
					
					tileContent |= topPlayer

					if((topPlayer & TILE_TYPE.PLAYER_WHITE) > 0){
						this.lightPieces.push([x,y])
					}
				}
				else if(y === 1){
					tileContent |= (TILE_TYPE.PAWN|topPlayer)
					if((topPlayer & TILE_TYPE.PLAYER_WHITE) > 0){
						this.lightPieces.push([x,y])
					}
				}
				else if(y === 8-1){
					if(x === 0 || x === 8-1) tileContent |= TILE_TYPE.CASTLE|TILE_TYPE.HAS_NOT_MOVED
					if(x === 1 || x === 8-2) tileContent |= TILE_TYPE.ROOK
					if(x === 2 || x === 8-3) tileContent |= TILE_TYPE.BISHOP
					if(x === 3) tileContent |= TILE_TYPE.QUEEN
					if(x === 4) tileContent |= TILE_TYPE.KING|TILE_TYPE.HAS_NOT_MOVED

					tileContent |= (bottomPlayer)

					if((topPlayer & TILE_TYPE.PLAYER_WHITE) > 0){
						this.darkPieces.push([x,y])
					}
				}
				else if(y === 8-2){
					tileContent |= (TILE_TYPE.PAWN|bottomPlayer)

					if((topPlayer & TILE_TYPE.PLAYER_WHITE) > 0){
						this.darkPieces.push([x,y])
					}
				}

				row.push(tileContent)
			}
			tiles.push(row)
		}

		return tiles
	}

	_coordInsideBoard(coord){
		return (coord[0] >= 0 && coord[0] < 8 && coord[1] >= 0 && coord[1] < 8)
	}

	//#region calculatePossibleMoves
	getPossibleMoves({board, piece, location}){
		let playingAs = this.settings.playingAs
		let moves = []
		if((piece & TILE_TYPE.PAWN) > 0){
			moves.push(...this._getPossiblePawnMoves({board, piece, location, playingAs}))
		}
		else if((piece & TILE_TYPE.ROOK)){
			moves.push(...this._getPossibleRookMoves({board, piece,location, playingAs}))
		}
		else if((piece & TILE_TYPE.CASTLE)){
			moves.push(...this._getPossibleCastleMoves({board, piece,location, playingAs}))
		}
		else if((piece & TILE_TYPE.BISHOP)){
			moves.push(...this._getPossibleBishopMoves({board, piece,location, playingAs}))
		}
		else if((piece & TILE_TYPE.QUEEN)){
			moves.push(...this._getPossibleQueenMoves({board, piece,location, playingAs}))
		}
		else if((piece & TILE_TYPE.KING)){
			 moves.push(...this._getPossibleKingMoves({board, piece, location, playingAs}))
		}
		return moves
	}

	*_getPossibleKingMoves({board, piece, location}){
		let dirs = [
			[1,1],
			[1,-1],
			[-1,1],
			[-1,-1],
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		]
		for(let dir of dirs){
			let move = [location[0]+dir[0], location[1] + dir[1]]
			if(!this._coordInsideBoard(move)) continue
			console.log(move)
			if((board[move[1]][move[0]] & piece & TILE_TYPE.PLAYERS) === 0){
				if(this._verifyKingIsSafeOnNewLocation({board, piece, oldLocation:location, newLocation:move})){
					yield move
				}
			}
		}
		if((piece&TILE_TYPE.HAS_NOT_MOVED)>0){
			/** Check rochade */
			let dirs = [1,-1]
			for(let dir of dirs){
				let tileInBetween = location
				do{
					tileInBetween = [tileInBetween[0]+dir,tileInBetween[1]]
					console.debug('tileinBetween',tileInBetween[0])
					if(tileInBetween[0]===0 || tileInBetween[0] === 7){
						if((board[tileInBetween[1]][tileInBetween[0]] & TILE_TYPE.CASTLE)>0){
							if((board[tileInBetween[1]][tileInBetween[0]] & TILE_TYPE.HAS_NOT_MOVED)>0){
								
								tileInBetween.push(TILE_TYPE.ROCKADE)
								console.log('add rockade',tileInBetween)
								yield tileInBetween
							}
						}
						break
					}
					/** verify space between is empty */
					if((board[tileInBetween[1]][tileInBetween[0]] & TILE_TYPE.PIECE_PLAYER)>0){
						break
					}
				}while(this._coordInsideBoard(tileInBetween))

				
			}
		}
	}
	*_getPossibleCastleMoves({board, piece, location}){
		let dirs = [
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		]

		for(let dir of dirs){
			let current = location
			do{
				let next = [current[0]+dir[0],current[1]+dir[1]]
				if(this._coordInsideBoard(next)){
					if((board[next[1]][next[0]] & TILE_TYPE.PIECE_PLAYER) === 0){
						yield next
					}
					else if((board[next[1]][next[0]] & ( TILE_TYPE.PLAYERS)) > 0){
						if((board[next[1]][next[0]] & (~piece & TILE_TYPE.PLAYERS)) > 0){
							yield next
						}
						break
					}
				}
				else break
				current = next
			}	while(true)
		}
	}
	*_getPossibleBishopMoves({board, piece, location}){
		let dirs = [
			[1,1],
			[1,-1],
			[-1,1],
			[-1,-1]
		]

		for(let dir of dirs){
			let current = location
			do{
				let next = [current[0]+dir[0],current[1]+dir[1]]
				if(this._coordInsideBoard(next)){
					if((board[next[1]][next[0]] & TILE_TYPE.PIECE_PLAYER) === 0){
						yield next
					}
					else if((board[next[1]][next[0]] & ( TILE_TYPE.PLAYERS)) > 0){
						if((board[next[1]][next[0]] & (~piece & TILE_TYPE.PLAYERS)) > 0){
							yield next
						}
						break
					}
				}
				else break
				current = next
			}	while(true)
		}
	}
	*_getPossibleQueenMoves({board, piece, location}){
		let dirs = [
			[1,1],
			[1,-1],
			[-1,1],
			[-1,-1],
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		]

		for(let dir of dirs){
			let current = location
			do{
				let next = [current[0]+dir[0],current[1]+dir[1]]
				if(this._coordInsideBoard(next)){
					if((board[next[1]][next[0]] & TILE_TYPE.PIECE_PLAYER) === 0){
						yield next
					}
					else if((board[next[1]][next[0]] & ( TILE_TYPE.PLAYERS)) > 0){
						if((board[next[1]][next[0]] & (~piece & TILE_TYPE.PLAYERS)) > 0){
							yield next
						}
						break
					}
				}
				else break
				current = next
			}	while(true)
		}
	}
	*_getPossibleRookMoves({board, piece, location}){
		let moveDeltas = [
			[2,1],
			[2,-1],
			[-2,1],
			[-2,-1],
			[1,2],
			[1,-2],
			[-1,2],
			[-1,-2]
		]
		for(let delta of moveDeltas){
			let destination = [location[0]+delta[0],location[1]+delta[1]]
			if(this._coordInsideBoard(destination)){
				/** check if the piece there is not your own */
				if((board[destination[1]][destination[0]] & (piece & TILE_TYPE.PLAYERS)) === 0){
					yield destination
				}
			}
		}
	}
	*_getPossiblePawnMoves({board, piece, location}){
		let playerWhite = (piece & TILE_TYPE.PLAYER_WHITE)>0
		let playingBottomSide = playerWhite === this.settings.whiteBottom
		let direction = playingBottomSide? -1 : 1

		/** 1. check if tile in front is free */
		if((board[location[1] + direction][location[0]] & TILE_TYPE.PIECES) === 0){
			let coord = [location[0], location[1] + direction]
			if(coord[1] === 0 || coord[1] === 7){
				coord.push(TILE_TYPE.PROMOTE)
			}
			yield coord

			/** 1.1. now that we know you can walk 1 step, check if at basestation, and if, doublestep is possible to */
			if((playingBottomSide && 8-location[1] === 2) || (!playingBottomSide && location[1] === 1)){
				let direction2 = playingBottomSide? -2 : 2
				if((board[location[1] + direction2][location[0]] & TILE_TYPE.PIECES) === 0){
					yield [location[0], location[1] + direction2, TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE]
				}
			}		
		}

		/** TODO: en passant code */
		if((board[location[1]][location[0] + 1] & TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE) > 0){
			yield [location[0] + 1, location[1]+direction, TILE_TYPE.EN_PASSANT, [location[0]+1,location[1]]]
		}
		if((board[location[1]][location[0]-1] & TILE_TYPE.PAWN_EN_PASSANT_VUlNERABLE) > 0){
			yield [location[0] - 1, location[1] + direction, TILE_TYPE.EN_PASSANT, [location[0]-1,location[1]]]
		}

		/**now check for possible attack moves */
		let enemyPlayer = playerWhite? TILE_TYPE.PLAYER_BLACK : TILE_TYPE.PLAYER_WHITE
		/** left attack */
		if(location[0] > 0){
			if((board[location[1]+direction][location[0]-1] & enemyPlayer) > 0){
				let coord = [location[0]-1, location[1] + direction]

				/** Promote to queen */
				if(coord[1] === 0 || coord[1] === 7){
					coord.push(TILE_TYPE.PROMOTE)
				}

				yield coord
			}
		}
		/** Right attack */
		if(location[0] < 8){
			if((board[location[1]+direction][location[0]+1] & enemyPlayer) > 0){

				let coord = [location[0]+1, location[1] + direction]

				/** Promote to queen */
				if(coord[1] === 0 || coord[1] === 7){
					coord.push(TILE_TYPE.PROMOTE)
				}

				yield coord
			}
		}
	}
	_verifyKingIsSafeOnNewLocation({board, piece, oldLocation, newLocation}){
		board = [ /**clone board */
			[...board[0]],
			[...board[1]],
			[...board[2]],
			[...board[3]],
			[...board[4]],
			[...board[5]],
			[...board[6]],
			[...board[7]],
		]

		/** we van verify this by checking for every unit type if the king can perform this move, because we know its the same the other way around */
		let location = newLocation
		board[oldLocation[1]][oldLocation[0]] &= ~TILE_TYPE.PIECE_PLAYER
		board[newLocation[1]][newLocation[0]] &= ~TILE_TYPE.PIECE_PLAYER
		board[newLocation[1]][newLocation[0]] |= piece

		/** first check for queen moves, since queen can do castle, bishop and queen moves */
		for(let dir of [
			[1,1],
			[1,-1],
			[-1,1],
			[-1,-1],
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		]){
			let current = newLocation
			do{
				let next = [current[0]+dir[0], current[1]+dir[1]]
				if(this._coordInsideBoard(next)){
					if((board[next[1]][next[0]] & ( TILE_TYPE.PLAYERS)) > 0){
						/**if piece is enemy piece check if it is a bishop,castle or queen, if so the move is not possible */
						if((board[next[1]][next[0]] & ~piece & TILE_TYPE.PLAYERS) > 0){
							if((board[next[1]][next[0]] & (TILE_TYPE.QUEEN|TILE_TYPE.CASTLE|TILE_TYPE.BISHOP)) > 0)
								return false
						}
						break
					}
				}
				else break
				current = next
			}	while(true)
		}
		/**now we only have the rook, king and pawn to go */

		/** ROOK */
		for(let delta of [
			[2,1],
			[2,-1],
			[-2,1],
			[-2,-1],
			[1,2],
			[1,-2],
			[-1,2],
			[-1,-2]
		]){
			let destination = [location[0]+delta[0],location[1]+delta[1]]
			if(this._coordInsideBoard(destination)){
				/** check if the piece there is not your own */
				if((board[destination[1]][destination[0]] & (~piece & TILE_TYPE.PLAYERS)) > 0){
					if((board[destination[1]][destination[0]] & TILE_TYPE.ROOK) > 0)
						return false
				}
			}
		}
		/** KING */
		let dirs = [
			[1,1],
			[1,-1],
			[-1,1],
			[-1,-1],
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		]
		for(let dir of dirs){
			let move = [location[0]+dir[0], location[1] + dir[1]]
			if(!this._coordInsideBoard(move)) continue
			if((board[move[1]][move[0]] & (~piece & TILE_TYPE.PLAYERS)) > 0){
				if((board[move[1]][move[0]] & TILE_TYPE.KING) > 0)
					return false
			}
		}

		/** PAWN */
		let playerWhite = (piece & TILE_TYPE.PLAYER_WHITE)>0
		let playingBottomSide = playerWhite === this.settings.whiteBottom
		let direction = playingBottomSide? -1 : 1

		/**now check for possible attack moves */
		let enemyPlayer = playerWhite? TILE_TYPE.PLAYER_BLACK : TILE_TYPE.PLAYER_WHITE
		/** left attack */
		if(location[0] > 0){
			if((board[location[1]+direction][location[0]-1] & enemyPlayer) > 0){
				if((board[location[1]+direction][location[0]-1] & TILE_TYPE.PAWN) > 0)
					return false
			}
		}
		/** Right attack */
		if(location[0] < 8){
			if((board[location[1]+direction][location[0]+1] & enemyPlayer) > 0){
				if((board[location[1]+direction][location[0]+1] & TILE_TYPE.PAWN) > 0)
					return false
			}
		}

		return true
	}
	//#endregion
	//#endregion
}
export default ChessGame