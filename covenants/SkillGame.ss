;; SkillGame.ss - Winner-Takes-All Covenant Contract
;; High Table Protocol
;; 
;; Rules:
;; - Winner takes all stakes (minus protocol fee)
;; - 2% protocol fee on winner's payout only
;; - Creator can cancel before opponent joins: full refund, 0 fee
;; - Forfeit mid-game: full stake goes to opponent (minus 2% fee)
;; - Both treasury addresses are hardcoded

;; =============================================================================
;; CONSTANTS - Hardcoded Treasury Addresses
;; =============================================================================

;; Primary protocol treasury address
(define TREASURY_PRIMARY 'ST1TREASURY_PRIMARY_ADDR)

;; Secondary/fee treasury address
(define TREASURY_SECONDARY 'ST1TREASURY_SECONDARY_ADDR)

;; Protocol fee percentage (2% = 200 basis points)
(define PROTOCOL_FEE_BPS u200)
(define BPS_DENOMINATOR u10000)

;; =============================================================================
;; DATA STORAGE
;; =============================================================================

;; Game states
(define-constant GAME_STATE_OPEN u0)       ;; Creator posted, waiting for opponent
(define-constant GAME_STATE_ACTIVE u1)     ;; Opponent joined, game in progress
(define-constant GAME_STATE_COMPLETED u2)  ;; Game finished, winner determined
(define-constant GAME_STATE_CANCELLED u3)  ;; Creator cancelled before opponent joined
(define-constant GAME_STATE_FORFEIT u4)    ;; Someone forfeited mid-game

;; Game data structure
(define-map games
  { game-id: uint }
  {
    creator: principal,
    opponent: (optional principal),
    stake: uint,
    state: uint,
    winner: (optional principal),
    created-at: uint,
    started-at: (optional uint)
  }
)

;; Nonce for generating unique game IDs
(define-data-var game-nonce uint u0)

;; =============================================================================
;; ERROR CODES
;; =============================================================================

(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_GAME_NOT_FOUND (err u101))
(define-constant ERR_GAME_NOT_OPEN (err u102))
(define-constant ERR_GAME_NOT_ACTIVE (err u103))
(define-constant ERR_ALREADY_JOINED (err u104))
(define-constant ERR_SAME_PLAYER (err u105))
(define-constant ERR_INVALID_STAKE (err u106))
(define-constant ERR_INVALID_STATE (err u107))
(define-constant ERR_TRANSFER_FAILED (err u108))
(define-constant ERR_NO_OPPONENT (err u109))
(define-constant ERR_ALREADY_COMPLETE (err u110))

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================

;; Calculate protocol fee (2% of amount)
(define-private (calculate-protocol-fee (amount uint))
  (/ (* amount PROTOCOL_FEE_BPS) BPS_DENOMINATOR)
)

;; Calculate winner payout (stake minus protocol fee)
;; Winner will receive: opponent's full stake + their stake back - fee
(define-private (calculate-winner-payout (total-stake uint))
  (let ((fee (calculate-protocol-fee total-stake)))
    (- total-stake fee)
  )
)

;; Generate unique game ID
(define-private (get-next-game-id)
  (let ((current (var-get game-nonce)))
    (var-set game-nonce (+ current u1))
    current
  )
)

;; Transfer STX to a principal
(define-private (transfer-stx (amount uint) (recipient principal))
  (stx-transfer? amount tx-sender recipient)
)

;; =============================================================================
;; PUBLIC FUNCTIONS - GAME LIFECYCLE
;; =============================================================================

;; Create a new game
;; Creator stakes their entry fee and waits for opponent
(define-public (create-game (stake uint))
  (let ((game-id (get-next-game-id)))
    ;; Validate stake
    (asserts! (> stake u0) ERR_INVALID_STAKE)
    
    ;; Transfer stake from creator
    (try! (stx-transfer? stake tx-sender (as-contract tx-sender)))
    
    ;; Create game record
    (map-set games
      { game-id: game-id }
      {
        creator: tx-sender,
        opponent: none,
        stake: stake,
        state: GAME_STATE_OPEN,
        winner: none,
        created-at: block-height,
        started-at: none
      }
    )
    
    (ok game-id)
  )
)

;; Cancel game (creator only, before opponent joins)
;; Full refund, 0 fee
(define-public (cancel-game (game-id uint))
  (let (
    (game (unwrap! (map-get? games { game-id: game-id }) ERR_GAME_NOT_FOUND))
    (creator (get creator game))
    (stake (get stake game))
    (state (get state game))
  )
    ;; Verify caller is creator
    (asserts! (is-eq tx-sender creator) ERR_NOT_AUTHORIZED)
    
    ;; Verify game is still open (no opponent yet)
    (asserts! (is-eq state GAME_STATE_OPEN) ERR_INVALID_STATE)
    
    ;; Refund full stake to creator
    (try! (as-contract (stx-transfer? stake tx-sender creator)))
    
    ;; Mark game as cancelled
    (map-set games
      { game-id: game-id }
      (merge game { state: GAME_STATE_CANCELLED })
    )
    
    (ok { refunded: stake, fee: u0 })
  )
)

;; Join an open game as opponent
;; Must match creator's stake exactly
(define-public (join-game (game-id uint))
  (let (
    (game (unwrap! (map-get? games { game-id: game-id }) ERR_GAME_NOT_FOUND))
    (creator (get creator game))
    (stake (get stake game))
    (state (get state game))
  )
    ;; Verify game is open
    (asserts! (is-eq state GAME_STATE_OPEN) ERR_GAME_NOT_OPEN)
    
    ;; Prevent creator from playing against themselves
    (asserts! (not (is-eq tx-sender creator)) ERR_SAME_PLAYER)
    
    ;; Verify no opponent yet
    (asserts! (is-none (get opponent game)) ERR_ALREADY_JOINED)
    
    ;; Transfer stake from opponent
    (try! (stx-transfer? stake tx-sender (as-contract tx-sender)))
    
    ;; Update game record
    (map-set games
      { game-id: game-id }
      (merge game {
        opponent: (some tx-sender),
        state: GAME_STATE_ACTIVE,
        started-at: (some block-height)
      })
    )
    
    (ok game-id)
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - GAME RESOLUTION
;; =============================================================================

;; Report winner - can be called by either player or protocol
;; Winner takes all from both stakes, minus 2% protocol fee
(define-public (report-winner (game-id uint) (winner principal))
  (let (
    (game (unwrap! (map-get? games { game-id: game-id }) ERR_GAME_NOT_FOUND))
    (creator (get creator game))
    (opponent-opt (get opponent game))
    (stake (get stake game))
    (state (get state game))
  )
    ;; Verify game is active
    (asserts! (is-eq state GAME_STATE_ACTIVE) ERR_GAME_NOT_ACTIVE)
    
    ;; Verify opponent exists
    (asserts! (is-some opponent-opt) ERR_NO_OPPONENT)
    
    (let (
      (opponent (unwrap! opponent-opt ERR_NO_OPPONENT))
      (total-stake (* stake u2))
      (protocol-fee (calculate-protocol-fee total-stake))
      (winner-payout (- total-stake protocol-fee))
      (fee-split (/ protocol-fee u2))
    )
      ;; Verify winner is either creator or opponent
      (asserts! (or (is-eq winner creator) (is-eq winner opponent)) ERR_NOT_AUTHORIZED)
      
      ;; Send fee to primary treasury
      (try! (as-contract (stx-transfer? fee-split tx-sender TREASURY_PRIMARY)))
      
      ;; Send fee to secondary treasury
      (try! (as-contract (stx-transfer? fee-split tx-sender TREASURY_SECONDARY)))
      
      ;; Send winner payout
      (try! (as-contract (stx-transfer? winner-payout tx-sender winner)))
      
      ;; Update game state
      (map-set games
        { game-id: game-id }
        (merge game {
          state: GAME_STATE_COMPLETED,
          winner: (some winner)
        })
      )
      
      (ok {
        winner: winner,
        payout: winner-payout,
        protocol-fee: protocol-fee,
        total-stake: total-stake
      })
    )
  )
)

;; Forfeit game - caller gives up, opponent wins
;; Forfeiter's stake goes to opponent, minus 2% protocol fee
;; Opponent gets their stake back plus forfeiter's stake minus fee
(define-public (forfeit (game-id uint))
  (let (
    (game (unwrap! (map-get? games { game-id: game-id }) ERR_GAME_NOT_FOUND))
    (creator (get creator game))
    (opponent-opt (get opponent game))
    (stake (get stake game))
    (state (get state game))
  )
    ;; Verify game is active
    (asserts! (is-eq state GAME_STATE_ACTIVE) ERR_GAME_NOT_ACTIVE)
    
    ;; Verify opponent exists
    (asserts! (is-some opponent-opt) ERR_NO_OPPONENT)
    
    (let (
      (opponent (unwrap! opponent-opt ERR_NO_OPPONENT))
      ;; Determine winner based on who is forfeiting
      (winner (if (is-eq tx-sender creator) opponent
                  (if (is-eq tx-sender opponent) creator tx-sender)))
      (total-stake (* stake u2))
      (protocol-fee (calculate-protocol-fee total-stake))
      (winner-payout (- total-stake protocol-fee))
      (fee-split (/ protocol-fee u2))
    )
      ;; Verify caller is either creator or opponent
      (asserts! (or (is-eq tx-sender creator) (is-eq tx-sender opponent)) ERR_NOT_AUTHORIZED)
      
      ;; Send fee to primary treasury
      (try! (as-contract (stx-transfer? fee-split tx-sender TREASURY_PRIMARY)))
      
      ;; Send fee to secondary treasury
      (try! (as-contract (stx-transfer? fee-split tx-sender TREASURY_SECONDARY)))
      
      ;; Send winner payout to opponent (the one who didn't forfeit)
      (try! (as-contract (stx-transfer? winner-payout tx-sender winner)))
      
      ;; Update game state
      (map-set games
        { game-id: game-id }
        (merge game {
          state: GAME_STATE_FORFEIT,
          winner: (some winner)
        })
      )
      
      (ok {
        winner: winner,
        payout: winner-payout,
        protocol-fee: protocol-fee,
        forfeiter: tx-sender
      })
    )
  )
)

;; =============================================================================
;; READ-ONLY FUNCTIONS
;; =============================================================================

;; Get game details
(define-read-only (get-game (game-id uint))
  (map-get? games { game-id: game-id })
)

;; Check if game is open for joining
(define-read-only (is-game-open (game-id uint))
  (match (map-get? games { game-id: game-id })
    game (is-eq (get state game) GAME_STATE_OPEN)
    false
  )
)

;; Get total stake locked in game
(define-read-only (get-total-stake (game-id uint))
  (match (map-get? games { game-id: game-id })
    game (let ((state (get state game))
               (stake (get stake game)))
           (if (is-eq state GAME_STATE_OPEN)
               stake
               (* stake u2)))
    u0
  )
)

;; Calculate potential payout for winning
(define-read-only (calculate-potential-payout (game-id uint))
  (match (map-get? games { game-id: game-id })
    game (let ((stake (get stake game))
               (total-stake (* stake u2)))
           (calculate-winner-payout total-stake))
    u0
  )
)

;; Get all game IDs (helper for off-chain indexing)
(define-read-only (get-game-count)
  (var-get game-nonce)
)
