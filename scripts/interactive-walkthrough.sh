#!/bin/bash
# NexxusFlow Interactive Walkthrough Script
# Demonstrates JWT Auth flows: Issuance -> Validation -> Revocation -> Rotation

RED="\033[0;31m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
NC="\033[0m"

echo -e "${BLUE}=== NexxusFlow JWT Lab Walkthrough ===${NC}"

# Check if service is up
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${RED}Error: JWT service is not running on :8080. Run 'make education-demo' first.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Step 1: Issuing a production-grade JWT for user 'jules' (admin)...${NC}"
AUTH_RESPONSE=$(curl -s -X POST http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"user_id":"jules", "role":"admin"}')

TOKEN=$(echo $AUTH_RESPONSE | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo -e "Received Token: ${BLUE}${TOKEN:0:20}...${NC}"

echo -e "\n${GREEN}Step 2: Verifying token with /state (simulated authenticated check)...${NC}"
curl -s http://localhost:8080/state

echo -e "\n${GREEN}Step 3: Revoking the token...${NC}"
REVOKE_RESPONSE=$(curl -s -X POST http://localhost:8080/revoke \
  -H "Authorization: Bearer $TOKEN")
echo -e "Response: $REVOKE_RESPONSE"

echo -e "\n${GREEN}Step 4: Attempting to use revoked token (should fail)...${NC}"
FAIL_RESPONSE=$(curl -s -X POST http://localhost:8080/revoke \
  -H "Authorization: Bearer $TOKEN")
echo -e "Response: $FAIL_RESPONSE"

echo -e "\n${GREEN}Step 5: Rotating the signing secret...${NC}"
NEW_SECRET="this-is-a-super-long-secure-replacement-secret"
ROTATE_RESPONSE=$(curl -s -X POST http://localhost:8080/rotate-secret \
  -H "Content-Type: application/json" \
  -d "{\"new_secret\":\"$NEW_SECRET\"}")
echo -e "Response: $ROTATE_RESPONSE"

echo -e "\n${GREEN}Step 6: Issuing a new token with the rotated secret...${NC}"
NEW_TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"user_id":"jules", "role":"admin"}')
NEW_TOKEN=$(echo $NEW_TOKEN_RESPONSE | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo -e "New Token: ${BLUE}${NEW_TOKEN:0:20}...${NC}"

echo -e "\n${BLUE}=== Walkthrough Complete ===${NC}"
