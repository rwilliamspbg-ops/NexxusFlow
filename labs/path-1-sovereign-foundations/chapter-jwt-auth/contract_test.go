package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestContractCompatibility(t *testing.T) {
	// 1. Get sample state from runtime
	runtime := newLabRuntime()
	state := runtime.snapshotState()

	// 2. Marshal to JSON
	payload, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("failed to marshal state: %v", err)
	}

	// 3. Write to temporary file
	tmpFile := filepath.Join(t.TempDir(), "state.json")
	if err := os.WriteFile(tmpFile, payload, 0644); err != nil {
		t.Fatalf("failed to write tmp file: %v", err)
	}

	// 4. Run verification script
	// Assuming we are in labs/path-1-sovereign-foundations/chapter-jwt-auth/
	repoRoot, err := filepath.Abs("../../../")
	if err != nil {
		t.Fatalf("failed to get repo root: %v", err)
	}

	scriptPath := filepath.Join(repoRoot, "scripts/verify-contract.sh")
	cmd := exec.Command(scriptPath, "lab-state", tmpFile)
	cmd.Dir = repoRoot

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Contract verification failed: %v\nOutput: %s", err, string(output))
	}

	t.Logf("Contract verification output: %s", string(output))
}
