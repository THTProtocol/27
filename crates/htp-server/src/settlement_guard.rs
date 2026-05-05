//! htp-server — settlement guard module
//!
//! Validation types for payout gating.
//! Ensures settlement only proceeds after ZK proof commit (or oracle fallback).

use serde::{Deserialize, Serialize};

/// Proof status — gates whether settlement can proceed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProofStatus {
    /// No proof has been submitted
    Pending,
    /// ZK commitment posted to Firebase or chain
    Committed,
    /// Proof verified by oracle (ZK succeeded)
    Verified,
    /// ZK commit failed, oracle fallback used
    OracleFallback,
    /// Proof challenged during dispute window
    Challenged,
    /// Proof rejected (invalid commitment or dispute lost)
    Rejected,
}

impl ProofStatus {
    pub fn can_settle(&self) -> bool {
        matches!(
            self,
            ProofStatus::Committed | ProofStatus::Verified | ProofStatus::OracleFallback
        )
    }

    pub fn is_final(&self) -> bool {
        matches!(
            self,
            ProofStatus::Verified | ProofStatus::OracleFallback | ProofStatus::Rejected
        )
    }
}

/// Oracle fallback reason — why ZK commit was bypassed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OracleFallbackReason {
    /// No moves were extractable from game state
    ZkNoMoves,
    /// Sequential chain commit builder returned null
    ZkBuildFail,
    /// Chain TX or Firebase commit timed out
    ZkTimeout,
    /// Unexpected error during ZK commit
    ZkError,
    /// Move count too low for meaningful proof (< 3 moves)
    TooFewMoves,
}

impl std::fmt::Display for OracleFallbackReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ZkNoMoves => write!(f, "no moves extractable"),
            Self::ZkBuildFail => write!(f, "commit builder returned null"),
            Self::ZkTimeout => write!(f, "ZK commit timed out"),
            Self::ZkError => write!(f, "unexpected ZK error"),
            Self::TooFewMoves => write!(f, "too few moves for meaningful proof"),
        }
    }
}

/// Settlement gate — holds proof status and optional fallback reason
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementGate {
    pub match_id: String,
    pub proof_status: ProofStatus,
    pub proof_root: Option<String>,
    pub fallback_reason: Option<OracleFallbackReason>,
    pub oracle: Option<String>,
    pub can_settle: bool,
}

impl SettlementGate {
    pub fn new(match_id: &str) -> Self {
        Self {
            match_id: match_id.to_string(),
            proof_status: ProofStatus::Pending,
            proof_root: None,
            fallback_reason: None,
            oracle: None,
            can_settle: false,
        }
    }

    pub fn committed(match_id: &str, root: &str) -> Self {
        Self {
            match_id: match_id.to_string(),
            proof_status: ProofStatus::Committed,
            proof_root: Some(root.to_string()),
            fallback_reason: None,
            oracle: None,
            can_settle: true,
        }
    }

    pub fn oracle_fallback(match_id: &str, reason: OracleFallbackReason, oracle: &str) -> Self {
        Self {
            match_id: match_id.to_string(),
            proof_status: ProofStatus::OracleFallback,
            proof_root: None,
            fallback_reason: Some(reason),
            oracle: Some(oracle.to_string()),
            can_settle: true,
        }
    }

    /// Update proof status and recompute can_settle
    pub fn update_status(&mut self, status: ProofStatus) {
        self.proof_status = status.clone();
        self.can_settle = status.can_settle();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proof_status_can_settle() {
        assert!(!ProofStatus::Pending.can_settle());
        assert!(ProofStatus::Committed.can_settle());
        assert!(ProofStatus::Verified.can_settle());
        assert!(ProofStatus::OracleFallback.can_settle());
        assert!(!ProofStatus::Challenged.can_settle());
        assert!(!ProofStatus::Rejected.can_settle());
    }

    #[test]
    fn pending_gate_blocks_settlement() {
        let gate = SettlementGate::new("match-1");
        assert!(!gate.can_settle);
        assert_eq!(gate.proof_status, ProofStatus::Pending);
    }

    #[test]
    fn committed_gate_allows_settlement() {
        let gate = SettlementGate::committed("match-2", "abc123...def456");
        assert!(gate.can_settle);
        assert_eq!(gate.proof_status, ProofStatus::Committed);
    }

    #[test]
    fn oracle_fallback_allows_settlement() {
        let gate = SettlementGate::oracle_fallback(
            "match-3",
            OracleFallbackReason::ZkTimeout,
            "kaspatest:oracle1",
        );
        assert!(gate.can_settle);
        assert_eq!(gate.proof_status, ProofStatus::OracleFallback);
    }

    #[test]
    fn fallback_reason_display() {
        assert_eq!(
            OracleFallbackReason::TooFewMoves.to_string(),
            "too few moves for meaningful proof"
        );
    }

    #[test]
    fn settlement_gate_roundtrip() {
        let gate = SettlementGate::committed("m1", "deadbeef".repeat(8).as_str());
        let json = serde_json::to_string(&gate).unwrap();
        let back: SettlementGate = serde_json::from_str(&json).unwrap();
        assert_eq!(back.match_id, "m1");
        assert!(back.can_settle);
    }
}
