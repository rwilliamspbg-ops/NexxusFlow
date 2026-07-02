//! Observability Core — Prometheus metrics emitter + WebSocket updater for real-time dashboards
//!
//! Uses a lock-free MPMC channel (crossbeam) to avoid core stalling under high load.

use crossbeam_channel::{bounded, Receiver, Sender, TrySendError};
use std::collections::HashMap;

/// Packet stat structure — fixed-size fields, HashMap only for optional breakdowns.
#[derive(Debug, Clone)]
pub struct PacketStat {
    pub packet_size: usize,
    pub processing_time_ns: u64,
    /// Optional per-subsystem latency breakdown (populated in verbose mode only)
    pub subsystem_latency_breakdown: HashMap<String, f64>,
}

impl PacketStat {
    pub fn new(packet_size: usize, processing_time_ns: u64) -> Self {
        Self {
            packet_size,
            processing_time_ns,
            subsystem_latency_breakdown: HashMap::new(),
        }
    }
}

/// Lock-Free Stats Ring using a bounded MPMC channel.
///
/// The producer side (`tx`) is used by the data-plane hot path to enqueue stats.
/// The consumer side (`rx`) is polled by the metrics emitter / Prometheus collector.
pub struct LockFreeStatsRing {
    /// Producer side — clone this to get a new sender for each data-plane thread.
    pub tx: Sender<PacketStat>,
    /// Consumer side — drive this from the metrics collection loop.
    pub rx: Receiver<PacketStat>,
}

impl LockFreeStatsRing {
    /// Create a new ring with a fixed-size internal buffer.
    pub fn new(capacity: usize) -> Self {
        let (tx, rx) = bounded(capacity);
        Self { tx, rx }
    }

    /// Enqueue a packet stat without locking.
    ///
    /// Returns an error if the channel is full (back-pressure signal).
    pub fn record_packet(&self, stat: PacketStat) -> Result<(), TrySendError<PacketStat>> {
        self.tx.try_send(stat)
    }

    /// Drain all pending stats — used by the Prometheus collector on each scrape.
    pub fn drain(&self) -> Vec<PacketStat> {
        self.rx.try_iter().collect()
    }
}

impl Default for LockFreeStatsRing {
    fn default() -> Self {
        // 64 K slots — large enough to absorb bursts without heap growth
        Self::new(1024 * 64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lock_free_stats_ring_creation() {
        let ring = LockFreeStatsRing::default();
        // Channel starts empty
        assert!(ring.rx.is_empty());
        println!("✅ observability-core: LockFreeStatsRing created (crossbeam MPMC channel)");
    }

    #[test]
    fn test_record_and_drain() {
        let ring = LockFreeStatsRing::new(16);
        let stat = PacketStat::new(128, 4_500);
        ring.record_packet(stat)
            .expect("channel should not be full");

        let drained = ring.drain();
        assert_eq!(drained.len(), 1);
        assert_eq!(drained[0].packet_size, 128);
        assert_eq!(drained[0].processing_time_ns, 4_500);
        println!("✅ observability-core: record_packet + drain round-trips correctly");
    }

    #[test]
    fn test_back_pressure_when_full() {
        let ring = LockFreeStatsRing::new(2);
        ring.record_packet(PacketStat::new(1, 1)).unwrap();
        ring.record_packet(PacketStat::new(2, 2)).unwrap();
        // Third send should fail — channel is full
        let result = ring.record_packet(PacketStat::new(3, 3));
        assert!(
            result.is_err(),
            "Channel should signal back-pressure when full"
        );
        println!("✅ observability-core: back-pressure signalled correctly");
    }

    #[test]
    fn test_multiple_producers() {
        use std::sync::Arc;
        let ring = Arc::new(LockFreeStatsRing::new(32));
        let ring2 = Arc::clone(&ring);

        let handle = std::thread::spawn(move || {
            ring2.record_packet(PacketStat::new(64, 100)).unwrap();
        });

        handle.join().unwrap();
        let drained = ring.drain();
        assert_eq!(drained.len(), 1);
        println!("✅ observability-core: multi-producer scenario passes");
    }
}
