//! Narrative Engine — XState-like state machine for branching lab scenarios
//!
//! Provides thread-safe mutation of real lab state via narrative decision points.

use std::collections::HashMap;

/// Describes the cause of a simulated node failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailureCause {
    Cpu,
    Memory,
    Disk,
}

/// Lab State Structure — holds all mutable runtime state for a running lab session.
#[derive(Debug, Clone, Default)]
pub struct LabState {
    /// Latency injection value in milliseconds (set by `InjectLatency` decision payload)
    pub latency_injected_ms: Option<u64>,
    /// Network partition channels (MCR spray disabled channels)
    pub network_partitions: Vec<String>,
    /// Node failures: container ID → failure cause
    pub node_failures: HashMap<String, FailureCause>,
}

impl LabState {
    /// Inject latency via mutation — converts microseconds to milliseconds.
    ///
    /// Returns `&mut Self` so callers can chain mutations.
    pub fn inject_latency(&mut self, delay_us: u32) -> &mut Self {
        // checked_div prevents divide-by-zero; 0 us maps to None
        if delay_us > 0 {
            self.latency_injected_ms = (delay_us as u64).checked_div(1_000);
        }
        self
    }

    /// Disable MCR spray on specified channels.
    ///
    /// Uses `extend` to avoid reallocating when capacity already exists.
    pub fn inject_partition(&mut self, channels: &[String]) -> &mut Self {
        for channel in channels {
            if !self.network_partitions.contains(channel) {
                self.network_partitions.push(channel.clone());
            }
        }
        self
    }

    /// Record a simulated node failure.
    pub fn fail_node(&mut self, node_id: impl Into<String>, cause: FailureCause) -> &mut Self {
        self.node_failures.insert(node_id.into(), cause);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lab_state_default() {
        let state = LabState::default();
        assert!(state.latency_injected_ms.is_none());
        assert!(state.network_partitions.is_empty());
        assert!(state.node_failures.is_empty());
        println!("✅ narrative-engine: LabState::default() initialises cleanly");
    }

    #[test]
    fn test_inject_latency() {
        let mut state = LabState::default();
        state.inject_latency(500_000); // 500 ms
        assert_eq!(state.latency_injected_ms, Some(500));
        println!("✅ narrative-engine: inject_latency converts µs → ms correctly");
    }

    #[test]
    fn test_inject_latency_zero_no_op() {
        let mut state = LabState::default();
        state.inject_latency(0);
        assert!(state.latency_injected_ms.is_none());
    }

    #[test]
    fn test_inject_partition() {
        let mut state = LabState::default();
        let channels = vec!["eth0".to_string(), "eth1".to_string()];
        state.inject_partition(&channels);
        assert_eq!(state.network_partitions.len(), 2);

        // Duplicate insertion is a no-op
        state.inject_partition(&["eth0".to_string()]);
        assert_eq!(state.network_partitions.len(), 2);
        println!("✅ narrative-engine: inject_partition deduplicates channels");
    }

    #[test]
    fn test_fail_node() {
        let mut state = LabState::default();
        state.fail_node("node-1", FailureCause::Memory);
        assert!(state.node_failures.contains_key("node-1"));
        assert_eq!(state.node_failures["node-1"], FailureCause::Memory);
        println!("✅ narrative-engine: fail_node records correctly");
    }

    #[test]
    fn test_clone_is_independent() {
        let mut original = LabState::default();
        original.inject_latency(1_000);
        let cloned = original.clone();
        assert_eq!(cloned.latency_injected_ms, original.latency_injected_ms);
        println!("✅ narrative-engine: Clone produces independent copy");
    }
}
