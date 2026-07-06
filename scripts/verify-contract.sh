#!/bin/bash

# Usage: ./scripts/verify-contract.sh <schema-name> <payload-file>

SCHEMA=$1
PAYLOAD=$2

if [ -z "$SCHEMA" ] || [ -z "$PAYLOAD" ]; then
    echo "Usage: $0 <schema-name> <payload-file>"
    false
fi

node packages/types-shared/dist/validate-payload.js "$SCHEMA" < "$PAYLOAD"
