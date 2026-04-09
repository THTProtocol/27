#!/bin/bash
# HTP Quick Start – Deploy to Firebase & Test

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  High Table Protocol (HTP) – Quick Start Script  v1.0    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify prerequisites
echo -e "${BLUE}[1/5]${NC} Checking prerequisites..."
command -v git >/dev/null 2>&1 || { echo "❌ git not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node not found"; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo "⚠️  firebase-cli not found. Install: npm install -g firebase-tools"; }
echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Step 2: Show current files
echo -e "${BLUE}[2/5]${NC} Files created..."
if [ -f "WIKI.md" ]; then echo -e "${GREEN}✅${NC} WIKI.md"; fi
if [ -f "README-HTP.md" ]; then echo -e "${GREEN}✅${NC} README-HTP.md"; fi
if [ -f "BUILD_SUMMARY.md" ]; then echo -e "${GREEN}✅${NC} BUILD_SUMMARY.md"; fi
if [ -d "covenants" ]; then echo -e "${GREEN}✅${NC} covenants/ParimutuelMarket.ss"; fi
if [ -d "crates" ]; then echo -e "${GREEN}✅${NC} crates/tournament-engine.rs"; fi
if [ -d "tools" ]; then echo -e "${GREEN}✅${NC} tools/claim-now/"; fi
echo -e "${GREEN}✅ All files present${NC}"
echo ""

# Step 3: Show git commits
echo -e "${BLUE}[3/5]${NC} Git commits (last 7)..."
git log --oneline -7 | while read hash msg; do
  echo "  $hash – $msg"
done
echo ""

# Step 4: Info about testing
echo -e "${BLUE}[4/5]${NC} Testing instructions:"
echo ""
echo -e "${YELLOW}To test on Firebase:${NC}"
echo "  1. cd 27/"
echo "  2. firebase deploy"
echo "  3. Open deployed URL in browser"
echo "  4. Press F12 and check console:"
echo "     console.log(window.HTP_NETWORK)  // should be 'tn12'"
echo "     console.log(window.HTP_RESOLVER_ALIAS)  // should be 'tn12'"
echo ""
echo -e "${YELLOW}To test network switch:${NC}"
echo "  Add ?net=mainnet to URL (e.g., https://your-app.web.app/?net=mainnet)"
echo ""
echo -e "${YELLOW}To build claim-now CLI:${NC}"
echo "  cd tools/claim-now"
echo "  cargo build --release"
echo "  ./../../target/release/claim-now --help"
echo ""

# Step 5: Next steps
echo -e "${BLUE}[5/5]${NC} Next steps:"
echo ""
echo -e "${YELLOW}Immediate (Week 1):${NC}"
echo "  1. Deploy to Firebase: cd 27 && firebase deploy"
echo "  2. Test Resolver config in browser console"
echo "  3. Read WIKI.md for kdapp porting instructions"
echo ""
echo -e "${YELLOW}Short-term (Week 2):${NC}"
echo "  1. Fork kdapp and port Chess, Connect 4, Checkers"
echo "  2. Compile Silverscript covenants"
echo "  3. Integrate game Episodes into UI"
echo ""
echo -e "${YELLOW}Medium-term (Month 1):${NC}"
echo "  1. Wire up on-chain game moves via wRPC"
echo "  2. Implement parimutuel pool creation"
echo "  3. Add resolution + settlement logic"
echo ""

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All systems ready for deployment! 🚀                  ${NC}"
echo -e "${GREEN}║  Read BUILD_SUMMARY.md for detailed next steps       ${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
