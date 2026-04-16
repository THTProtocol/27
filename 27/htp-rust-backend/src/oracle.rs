//! oracle.rs - Game move validators and settlement signing.
//! Ports htp-oracle-server.js to native Rust.
//! Routes: POST /oracle/chess, /oracle/connect4, /oracle/tictactoe, /oracle/resign

use serde::{Deserialize, Serialize};
use sha2::Sha256;
use hmac::{Hmac, Mac};
use hex;

type HmacSha256 = Hmac<Sha256>;

fn sign_result(match_id: &str, winner: &str, reason: &str) -> Option<String> {
    let key = std::env::var("HTP_ORACLE_PRIV_KEY").ok()?;
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).ok()?;
    mac.update(format!("{}:{}:{}", match_id, winner, reason).as_bytes());
    Some(hex::encode(mac.finalize().into_bytes()))
}

const ROWS: usize = 6;
const COLS: usize = 7;

#[derive(Deserialize)]
pub struct Connect4Request {
    pub match_id: Option<String>,
    pub board: Vec<Vec<Option<u8>>>,
    pub col: usize,
    pub player: u8,
    pub player_id: Option<String>,
}

#[derive(Serialize)]
pub struct Connect4Response {
    pub valid: bool,
    pub board: Option<Vec<Vec<Option<u8>>>>,
    pub row: Option<usize>,
    pub col: Option<usize>,
    pub player: Option<u8>,
    pub game_over: bool,
    pub winner: Option<String>,
    pub reason: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

fn check_c4_win(board: &[Vec<Option<u8>>], player: u8) -> bool {
    let dirs: [(i32, i32); 4] = [(0,1),(1,0),(1,1),(1,-1)];
    for r in 0..ROWS { for c in 0..COLS {
        if board[r][c] != Some(player) { continue; }
        for (dr,dc) in &dirs {
            let mut n = 1u32;
            for i in 1..4i32 {
                let nr=r as i32+dr*i; let nc=c as i32+dc*i;
                if nr<0||nr>=ROWS as i32||nc<0||nc>=COLS as i32 { break; }
                if board[nr as usize][nc as usize]!=Some(player) { break; }
                n+=1;
            }
            if n>=4 { return true; }
        }
    }}
    false
}

pub fn validate_connect4_move(req: &Connect4Request) -> Connect4Response {
    if req.col>=COLS||req.board.len()!=ROWS {
        return Connect4Response{valid:false,board:None,row:None,col:None,player:None,game_over:false,winner:None,reason:None,signature:None,error:Some("Invalid col or board".into())};
    }
    let row=(0..ROWS).rev().find(|&r| req.board[r][req.col].is_none());
    let Some(row)=row else {
        return Connect4Response{valid:false,board:None,row:None,col:None,player:None,game_over:false,winner:None,reason:None,signature:None,error:Some("Column full".into())};
    };
    let mut nb=req.board.clone();
    nb[row][req.col]=Some(req.player);
    let won=check_c4_win(&nb,req.player);
    let full=nb[0].iter().all(|c|c.is_some());
    let draw=!won&&full;
    let game_over=won||draw;
    let winner=if won{Some(req.player.to_string())}else if draw{Some("draw".into())}else{None};
    let reason=if won{Some("connect4".into())}else if draw{Some("draw".into())}else{None};
    let signature=if game_over{if let(Some(mid),Some(ref w),Some(ref rs))=(&req.match_id,&winner,&reason){sign_result(mid,w,rs)}else{None}}else{None};
    Connect4Response{valid:true,board:Some(nb),row:Some(row),col:Some(req.col),player:Some(req.player),game_over,winner,reason,signature,error:None}
}

#[derive(Deserialize)]
pub struct TicTacToeRequest {
    pub match_id: Option<String>,
    pub board: Vec<Option<String>>,
    pub cell: usize,
    pub player: String,
    pub player_id: Option<String>,
}

#[derive(Serialize)]
pub struct TicTacToeResponse {
    pub valid: bool,
    pub board: Option<Vec<Option<String>>>,
    pub game_over: bool,
    pub winner: Option<String>,
    pub reason: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

pub fn validate_tictactoe_move(req: &TicTacToeRequest) -> TicTacToeResponse {
    if req.cell>8||req.board.len()!=9{
        return TicTacToeResponse{valid:false,board:None,game_over:false,winner:None,reason:None,signature:None,error:Some("Cell/board invalid".into())};
    }
    if req.board[req.cell].as_deref().map(|s|!s.is_empty()).unwrap_or(false){
        return TicTacToeResponse{valid:false,board:None,game_over:false,winner:None,reason:None,signature:None,error:Some("Cell occupied".into())};
    }
    let mut nb=req.board.clone();
    nb[req.cell]=Some(req.player.clone());
    const LINES:[[usize;3];8]=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let mut winner:Option<String>=None;
    for line in &LINES{
        let a=nb[line[0]].as_deref(); let b=nb[line[1]].as_deref(); let c=nb[line[2]].as_deref();
        if let(Some(av),Some(bv),Some(cv))=(a,b,c){
            if !av.is_empty()&&av==bv&&bv==cv{winner=Some(av.to_string());break;}
        }
    }
    let full=nb.iter().all(|c|c.as_deref().map(|s|!s.is_empty()).unwrap_or(false));
    let draw=winner.is_none()&&full;
    let game_over=winner.is_some()||draw;
    let final_winner=winner.or_else(||if draw{Some("draw".into())}else{None});
    let reason=if game_over{if draw{Some("draw".into())}else{Some("win".into())}}else{None};
    let signature=if game_over{if let(Some(mid),Some(ref w),Some(ref rs))=(&req.match_id,&final_winner,&reason){sign_result(mid,w,rs)}else{None}}else{None};
    TicTacToeResponse{valid:true,board:Some(nb),game_over,winner:final_winner,reason,signature,error:None}
}

#[derive(Deserialize)]
pub struct ChessMoveRequest {
    pub match_id: Option<String>,
    pub pgn: Option<String>,
    pub mv: String,
    pub player_id: Option<String>,
}

#[derive(Serialize)]
pub struct ChessMoveResponse {
    pub valid: bool,
    pub pgn: Option<String>,
    pub game_over: bool,
    pub winner: Option<String>,
    pub reason: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

/// Chess validation stub - full shakmaty engine integration is next PR.
/// Firebase Functions JS oracle remains active until that lands.
pub fn validate_chess_move(req: &ChessMoveRequest) -> ChessMoveResponse {
    if req.mv.is_empty(){
        return ChessMoveResponse{valid:false,pgn:None,game_over:false,winner:None,reason:None,signature:None,error:Some("Missing move".into())};
    }
    ChessMoveResponse{valid:true,pgn:req.pgn.clone(),game_over:false,winner:None,reason:None,signature:None,error:None}
}

#[derive(Deserialize)]
pub struct ResignRequest {
    pub match_id: String,
    pub resigning_address: String,
    pub winner_address: String,
}

#[derive(Serialize)]
pub struct ResignResponse {
    pub success: bool,
    pub winner: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

pub fn process_resign(req: &ResignRequest) -> ResignResponse {
    if req.match_id.is_empty()||req.winner_address.is_empty(){
        return ResignResponse{success:false,winner:None,signature:None,error:Some("Missing params".into())};
    }
    let sig=sign_result(&req.match_id,&req.winner_address,"resign");
    ResignResponse{success:true,winner:Some(req.winner_address.clone()),signature:sig,error:None}
}
