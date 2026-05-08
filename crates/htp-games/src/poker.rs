//! High Table Protocol - Texas Hold'em Poker Engine
//! Ported from 456-line JS engine. 2-player, blinds, full hand evaluation, betting rounds.

use serde::{Deserialize, Serialize};
use rand::seq::SliceRandom;
use crate::{GameError, GameOutcome, GameStatus};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct PokerCard { pub rank: u8, pub suit: u8 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum HandRank { HighCard=0, OnePair, TwoPair, ThreeOfKind, Straight, Flush, FullHouse, FourOfKind, StraightFlush, RoyalFlush }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandEval { pub rank: HandRank, pub kickers: Vec<u8>, pub cards: Vec<PokerCard> }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PokerStage { Preflop=0, Flop, Turn, River, Showdown }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PokerAction { Fold, Check, Call, Raise(u32), AllIn }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PokerActionResult {
    pub state: Option<PokerState>,
    pub finished: bool,
    pub winner: Option<String>,
    pub reason: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerPlayer { pub addr: String, pub name: String, pub chips: u32, pub hole_cards: Vec<PokerCard>, pub bet: u32, pub total_bet: u32, pub folded: bool, pub all_in: bool, pub hand_rank: Option<HandEval> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerState {
    pub stage: PokerStage, pub stage_name: String, pub community: Vec<PokerCard>,
    pub pot: u32, pub current_bet: u32, pub min_raise: u32,
    pub players: Vec<PokerPlayer>, pub active_player_idx: usize,
    pub dealer_idx: usize, pub small_blind: u32, pub big_blind: u32,
    pub last_raiser_idx: Option<usize>, pub acted_this_round: Vec<bool>,
    pub hand_number: u32, pub finished: bool,
    #[serde(skip)] pub deck: Vec<PokerCard>,
    #[serde(skip)] sb_idx: usize, #[serde(skip)] bb_idx: usize,
    finished_reason: Option<String>,
}

fn make_deck() -> Vec<PokerCard> {
    (2u8..=14).flat_map(|rank| (0..4).map(move |suit| PokerCard{rank,suit})).collect()
}

fn card_val(c: &PokerCard) -> u8 { c.rank }

fn choose_combos(cards: &[PokerCard]) -> Vec<Vec<PokerCard>> {
    let n = cards.len(); if n==5 {return vec![cards.to_vec()];}
    let mut out=vec![];
    for a in 0..n-4{for b in a+1..n-3{for c in b+1..n-2{for d in c+1..n-1{for e in d+1..n{
        out.push(vec![cards[a],cards[b],cards[c],cards[d],cards[e]]);
    }}}}}
    out
}

fn check_straight(vals: &[u8]) -> Option<u8> {
    let mut u: Vec<u8>=vals.to_vec(); u.dedup(); if u.len()<5{return None;}
    if u[0]-u[4]==4{return Some(u[0]);}
    if u[0]==14&&u[1]==5&&u[2]==4&&u[3]==3&&u[4]==2{return Some(5);}
    None
}

fn evaluate5(cards: &[PokerCard]) -> HandEval {
    let mut vals: Vec<u8>=cards.iter().map(card_val).collect();
    vals.sort_unstable_by(|a,b|b.cmp(a));
    let flush=cards.iter().all(|c|c.suit==cards[0].suit);
    let sh=check_straight(&vals); let straight=sh.is_some();
    let mut cnt=HashMap::new();
    for v in &vals{*cnt.entry(*v).or_default()+=1;}
    let mut g: Vec<(u8,u8)>=cnt.iter().map(|(&k,&v)|(k,v)).collect();
    g.sort_by(|a,b|b.1.cmp(&a.1).then(b.0.cmp(&a.0)));

    let(rank,kickers)=match(flush,straight,g.as_slice()){
        (true,true,_) if vals[0]==14&&vals[1]==13=>(HandRank::RoyalFlush,vec![sh.unwrap()]),
        (true,true,_)=>(HandRank::StraightFlush,vec![sh.unwrap()]),
        (_,_,[(_,4),(o,1),..])=>(HandRank::FourOfKind,vec![g[0].0,*o]),
        (_,_,[(t,3),(p,2),..])=>(HandRank::FullHouse,vec![*t,*p]),
        (true,false,_)=>(HandRank::Flush,vals.clone()),
        (false,true,_)=>(HandRank::Straight,vec![sh.unwrap()]),
        (_,_,[(t,3),..])=>{let mut k=vec![*t];k.extend(vals.iter().filter(|&&v|v!=*t));k;(HandRank::ThreeOfKind,k)}.1,
        (_,_,[(p1,2),(p2,2),(k,1),..])=>(HandRank::TwoPair,vec![*p1.max(p2),*p1.min(p2),*k]),
        (_,_,[(p,2),..])=>{let mut k=vec![*p];k.extend(vals.iter().filter(|&&v|v!=*p));k;(HandRank::OnePair,k)}.1,
        _=>(HandRank::HighCard,vals.clone()),
    };
    HandEval{rank,kickers,cards:cards.to_vec()}
}

fn cmp_kickers(a:&[u8],b:&[u8])->std::cmp::Ordering{
    for(x,y)in a.iter().zip(b.iter()){let o=x.cmp(y);if o!=std::cmp::Ordering::Equal{return o;}}
    a.len().cmp(&b.len())
}

pub fn evaluate_hand(cards:&[PokerCard])->HandEval{
    if cards.len()<5{return HandEval{rank:HandRank::HighCard,kickers:cards.iter().map(card_val).rev().collect(),cards:cards.to_vec()};}
    let combos=choose_combos(cards); let mut best:Option<HandEval>=None;
    for c in combos{let ev=evaluate5(&c); if let Some(ref b)=best{if ev.rank>b.rank||(ev.rank==b.rank&&cmp_kickers(&ev.kickers,&b.kickers)==std::cmp::Ordering::Greater){best=Some(ev);}}else{best=Some(ev);}}
    best.unwrap()
}

impl PokerState{
    pub fn new(players:Vec<(String,String)>,stake_kas:u32,sb:u32,bb:u32)->Self{
        let chips=stake_kas*10; let mut d=make_deck();
        {let mut rng=rand::thread_rng(); d.shuffle(&mut rng);}
        let sb_i=0; let bb_i=1;
        let mut ps:Vec<PokerPlayer>=players.into_iter().enumerate().map(|(i,(a,n))|{
            PokerPlayer{addr:a,name:n,chips,hole_cards:vec![d.pop().unwrap(),d.pop().unwrap()],bet:0,total_bet:0,folded:false,all_in:false,hand_rank:None}
        }).collect();
        ps[sb_i].chips=ps[sb_i].chips.saturating_sub(sb); ps[sb_i].bet=sb; ps[sb_i].total_bet=sb;
        ps[bb_i].chips=ps[bb_i].chips.saturating_sub(bb); ps[bb_i].bet=bb; ps[bb_i].total_bet=bb;
        let n=ps.len();
        PokerState{stage:PokerStage::Preflop,stage_name:"preflop".into(),deck:d,community:vec![],pot:sb+bb,current_bet:bb,min_raise:bb,players:ps,active_player_idx:(bb_i+1)%n,dealer_idx:0,sb_idx:sb_i,bb_idx:bb_i,small_blind:sb,big_blind:bb,last_raiser_idx:Some(bb_i),acted_this_round:vec![false;n],hand_number:1,finished:false,finished_reason:None}
    }

    pub fn to_public(&self,viewer:&str)->Self{
        let mut s=self.clone();
        for p in &mut s.players{if p.addr!=viewer&&self.stage!=PokerStage::Showdown{p.hole_cards=vec![PokerCard{rank:0,suit:0};2];}}
        s.deck=vec![]; s
    }

    pub fn apply_action(&mut self,action:&PokerAction)->PokerActionResult{
        if self.finished{return PokerActionResult{error:Some("hand over".into()),finished:true,..Default::default()};}
        let i=self.active_player_idx;
        let p=&mut self.players[i];
        let amt=match action{PokerAction::Raise(a)=>*a,PokerAction::AllIn=>p.chips,_=>0};
        match action{
            PokerAction::Fold=>{p.folded=true;self.acted_this_round[i]=true;}
            PokerAction::Check=>{if self.current_bet!=p.bet{return PokerActionResult{error:Some("must call or raise".into()),..Default::default()};}self.acted_this_round[i]=true;}
            PokerAction::Call=>{let call=self.current_bet-p.bet;let a=call.min(p.chips);p.chips-=a;p.bet+=a;p.total_bet+=a;self.pot+=a;if p.chips==0{p.all_in=true;}self.acted_this_round[i]=true;}
            PokerAction::Raise(_)=>{
                if amt<self.min_raise&&p.chips>=self.min_raise+self.current_bet-p.bet{return PokerActionResult{error:Some(format!("min raise {}",self.min_raise)),..Default::default()};}
                let need=amt+self.current_bet-p.bet;let a=need.min(p.chips);p.chips-=a;p.bet+=a;p.total_bet+=a;self.pot+=a;self.current_bet=p.bet;self.min_raise=amt;self.last_raiser_idx=Some(i);if p.chips==0{p.all_in=true;}self.acted_this_round=vec![false;self.players.len()];self.acted_this_round[i]=true;
            }
            PokerAction::AllIn=>{let a=p.chips;p.chips=0;p.bet+=a;p.total_bet+=a;self.pot+=a;p.all_in=true;if p.bet>self.current_bet{self.current_bet=p.bet;let ra=p.bet-self.current_bet+a;if ra>=self.min_raise{self.min_raise=ra;self.last_raiser_idx=Some(i);self.acted_this_round=vec![false;self.players.len()];}}self.acted_this_round[i]=true;}
        }
        let active:Vec<_>=self.players.iter().filter(|p|!p.folded).collect();
        if active.len()==1{let wa=active[0].addr.clone();self.players.iter_mut().find(|p|p.addr==wa).unwrap().chips+=self.pot;self.finished=true;self.finished_reason=Some("fold".into());return PokerActionResult{finished:true,winner:Some(wa),reason:Some("fold".into()),..Default::default()};}
        if self.is_round_done(){return self.advance_stage();}
        let mut nxt=(i+1)%self.players.len();while self.players[nxt].folded||self.players[nxt].all_in{nxt=(nxt+1)%self.players.len();if nxt==i{break;}}self.active_player_idx=nxt;
        PokerActionResult{state:Some(self.clone()),..Default::default()}
    }

    fn is_round_done(&self)->bool{
        let a:Vec<_>=self.players.iter().enumerate().filter(|(_,p)|!p.folded&&!p.all_in).collect();
        if a.is_empty(){return true;} a.iter().all(|(i,p)|self.acted_this_round[*i]&&p.bet==self.current_bet)
    }

    fn advance_stage(&mut self)->PokerActionResult{
        for p in &mut self.players{p.bet=0;} self.current_bet=0; self.min_raise=self.big_blind; self.acted_this_round=vec![false;self.players.len()]; self.last_raiser_idx=None;
        match self.stage{
            PokerStage::Preflop=>{self.deal(3);self.stage=PokerStage::Flop;self.stage_name="flop".into();}
            PokerStage::Flop=>{self.deal(1);self.stage=PokerStage::Turn;self.stage_name="turn".into();}
            PokerStage::Turn=>{self.deal(1);self.stage=PokerStage::River;self.stage_name="river".into();}
            PokerStage::River=>return self.showdown(),
            PokerStage::Showdown=>return PokerActionResult{error:Some("already showdown".into()),finished:true,..Default::default()},
        }
        let mut n=(self.dealer_idx+1)%self.players.len();while self.players[n].folded||self.players[n].all_in{n=(n+1)%self.players.len();}self.active_player_idx=n;
        PokerActionResult{state:Some(self.clone()),..Default::default()}
    }

    fn deal(&mut self,n:usize){self.deck.pop();for _ in 0..n{if let Some(c)=self.deck.pop(){self.community.push(c);}}}

    fn showdown(&mut self)->PokerActionResult{
        self.stage=PokerStage::Showdown;self.stage_name="showdown".into();
        for p in &mut self.players{if p.folded{continue;}let ac:Vec<PokerCard>=p.hole_cards.iter().chain(self.community.iter()).copied().collect();p.hand_rank=Some(evaluate_hand(&ac));}
        let mut a:Vec<usize>=self.players.iter().enumerate().filter(|(_,p)|!p.folded).map(|(i,_)|i).collect();
        a.sort_by(|&x,&y|{
            let rx=self.players[x].hand_rank.as_ref().map(|e|e.rank).unwrap_or(HandRank::HighCard);
            let ry=self.players[y].hand_rank.as_ref().map(|e|e.rank).unwrap_or(HandRank::HighCard);
            match ry.cmp(&rx){std::cmp::Ordering::Equal=>{let kx=self.players[x].hand_rank.as_ref().map(|e|&*e.kickers);let ky=self.players[y].hand_rank.as_ref().map(|e|&*e.kickers);match(kx,ky){(Some(a),Some(b))=>cmp_kickers(b,a),_=>std::cmp::Ordering::Equal,}}o=>o,}
        });
        let w=&self.players[a[0]];let wa=w.addr.clone();let r=w.hand_rank.as_ref().map(|e|format!("{:?}",e.rank)).unwrap_or_default();
        self.players[a[0]].chips+=self.pot;self.finished=true;self.finished_reason=Some(r.clone());
        PokerActionResult{state:Some(self.clone()),finished:true,winner:Some(wa),reason:Some(r),..Default::default()}
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerGame { pub state: PokerState, pub status: GameStatus, pub outcome: GameOutcome }

impl PokerGame{
    pub fn new(a:String,b:String,stake:u32,sb:u32,bb:u32)->Self{
        PokerGame{state:PokerState::new(vec![(a,"P1".into()),(b,"P2".into())],stake,sb,bb),status:GameStatus::Active,outcome:GameOutcome::Pending}
    }
    pub fn action(&mut self,addr:&str,act:&PokerAction)->PokerActionResult{
        let cur=&self.state.players[self.state.active_player_idx].addr;
        if cur!=addr{return PokerActionResult{error:Some(format!("not your turn — {}",cur)),..Default::default()};}
        let r=self.state.apply_action(act);
        if r.finished{self.status=GameStatus::Complete;self.outcome=match r.winner.as_deref(){
            Some(w) if *w==self.state.players[0].addr=>GameOutcome::Player1Wins,
            Some(_)=>GameOutcome::Player2Wins,None=>GameOutcome::Draw,};}
        r
    }
}

impl Default for PokerGame{fn default()->Self{Self::new("".into(),"".into(),10,1,2)}}
