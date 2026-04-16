// htp-oracle-pipeline.js — alias for htp-zk-pipeline.js
// The pipeline uses SHA-256 oracle commits (not ZK proofs) until Toccata HF.
// This file exists so scripts referencing 'htp-oracle-pipeline' still load correctly.
// After Toccata, this will load the Groth16/R0Succinct on-chain verify path.
console.log('[HTP] htp-oracle-pipeline.js loaded (alias → htp-zk-pipeline.js, Toccata-ready)');
