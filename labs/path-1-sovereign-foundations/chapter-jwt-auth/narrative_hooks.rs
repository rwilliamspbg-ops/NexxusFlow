//! Narrative Hooks — State Mutation API for the JWT Auth lab chapter
//!
//! These types mirror the TypeScript decision-point payloads defined in
//! `packages/types-shared/src/lab-chapter.ts` and are applied by the
//! narrative engine's state machine.

use std::collections::HashSet;
use std::time::Duration;

/// Payload: inject artificial socket-level latency into the data path.
///
/// `delay_us` is in **microseconds**. Values outside `[1, 1_000_000)` are clamped/rejected.
#[derive(Debug, Clone)]
pub struct InjectLatency {
    pub delay_us: u32,
}

impl InjectLatency {
    /// Apply the latency injection (simulated via thread sleep in a containerised demo).
    pub fn apply(&self) -> Result<(), String> {
        if self.delay_us == 0 {
            return Err("delay_us must be > 0".to_string());
        }
        if self.delay_us >= 1_000_000 {
            return Err(format!(
                "delay_us {} exceeds 1-second cap; use network-level tooling instead",
                self.delay_us
            ));
        }
        std::thread::sleep(Duration::from_micros(self.delay_us as u64));
        println!("⏱️  Latency injected: {} µs", self.delay_us);
        Ok(())
    }
}

/// Payload: disable MCR spray on specific network channel interfaces.
#[derive(Debug, Clone)]
pub struct PartitionNetwork {
    pub channels: HashSet<String>,
}

impl PartitionNetwork {
    /// Record which channels are partitioned (printed in demo; real impl uses Docker network).
    pub fn apply(&self) -> Result<(), String> {
        if self.channels.is_empty() {
            return Err("PartitionNetwork requires at least one channel".to_string());
        }
        for channel in &self.channels {
            println!("🔌 Network partition active on channel: {}", channel);
        }
        Ok(())
    }
}

/// Describes the cause of a simulated node failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FailureCause {
    Cpu,
    Memory,
    Disk,
}

/// Payload: simulate a node failure (container termination or eBPF syscall error injection).
#[derive(Debug, Clone)]
pub struct FailNode {
    pub node_id: String,
    pub cause: FailureCause,
}

impl FailNode {
    /// Simulate the failure (prints in demo; real impl sends SIGKILL to container).
    pub fn apply(&self) -> Result<(), String> {
        let reason = match self.cause {
            FailureCause::Cpu => "CPU overloaded",
            FailureCause::Memory => "Memory pressure high (mocked OOM)",
            FailureCause::Disk => "Disk I/O latency spike",
        };
        println!("💥 Node failure simulated: {} ({})", self.node_id, reason);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_latency_zero_rejected() {
        let hook = InjectLatency { delay_us: 0 };
        assert!(hook.apply().is_err());
    }

    #[test]
    fn test_inject_latency_over_cap_rejected() {
        let hook = InjectLatency { delay_us: 2_000_000 };
        assert!(hook.apply().is_err());
    }

    #[test]
    fn test_partition_network_empty_rejected() {
        let hook = PartitionNetwork {
            channels: HashSet::new(),
        };
        assert!(hook.apply().is_err());
    }

    #[test]
    fn test_partition_network_applies() {
        let mut channels = HashSet::new();
        channels.insert("eth0".to_string());
        let hook = PartitionNetwork { channels };
        assert!(hook.apply().is_ok());
    }

    #[test]
    fn test_fail_node() {
        let hook = FailNode {
            node_id: "node-1".to_string(),
            cause: FailureCause::Memory,
        };
        assert!(hook.apply().is_ok());
    }
}
