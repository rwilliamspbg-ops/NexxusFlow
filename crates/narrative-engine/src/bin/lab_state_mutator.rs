//! lab_state_mutator — CLI binary for testing narrative engine state transitions
//!
//! Run with:
//!   cargo run -p narrative-engine --bin lab_state_mutator
//!
//! Demonstrates all three mutation types: latency injection, network partition,
//! and node failure simulation.

use narrative_engine::{FailureCause, LabState};

fn main() {
    println!("🚀 NexusFlow Narrative Engine — Lab State Mutator Demo");

    let mut state = LabState::default();
    println!("📋 Initial state: {:?}", state);

    // ── Decision point 1: inject latency ────────────────────────────────────
    state.inject_latency(250_000).expect("latency mutation failed"); // 250 ms
    println!(
        "⏱️  After InjectLatency(250 ms): latency_injected_ms = {:?}",
        state.latency_injected_ms
    );

    // ── Decision point 2: partition network channels ─────────────────────────
    let channels = vec!["eth0".to_string(), "eth1".to_string()];
    state.inject_partition(&channels).expect("partition mutation failed");
    println!(
        "🔌 After InjectPartition: network_partitions = {:?}",
        state.network_partitions
    );

    // Duplicate insert is a no-op
    state.inject_partition(&["eth0".to_string()]).expect("duplicate partition mutation failed");
    println!(
        "   (duplicate insert ignored — still {} channels)",
        state.network_partitions.len()
    );

    // ── Decision point 3: fail a node ────────────────────────────────────────
    state.fail_node("replica-2", FailureCause::Memory);
    println!(
        "💥 After FailNode: node_failures = {:?}",
        state.node_failures
    );

    println!("\n✅ All narrative state mutations applied successfully.");
}
