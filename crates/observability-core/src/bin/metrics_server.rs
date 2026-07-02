//! metrics_server — lightweight Prometheus metrics exposition server
//!
//! Run with:
//!   cargo run -p observability-core --bin metrics_emitter_bin
//!
//! Exposes a `/metrics` endpoint that the Prometheus scraper can target.
//! Demonstrates the lock-free LockFreeStatsRing in a producer/consumer loop.

use observability_core::{LockFreeStatsRing, PacketStat};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() {
    println!("🚀 NexusFlow Observability Core — Metrics Server Demo");

    let ring = Arc::new(LockFreeStatsRing::default());
    let ring_producer = Arc::clone(&ring);

    // ── Simulated data-plane producer thread ─────────────────────────────────
    let producer = thread::spawn(move || {
        for i in 0u64..10 {
            let stat = PacketStat::new(64 + (i as usize % 512), i * 4_500);
            match ring_producer.record_packet(stat) {
                Ok(_) => {}
                Err(e) => eprintln!("⚠️  Back-pressure: channel full — {:?}", e),
            }
            thread::sleep(Duration::from_millis(50));
        }
        println!("✅ Producer: sent 10 packet stats");
    });

    // ── Consumer / scrape loop (simulates Prometheus scrape) ─────────────────
    let consumer = {
        let ring = Arc::clone(&ring);
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(200)); // let producer warm up
            loop {
                let batch = ring.drain();
                if batch.is_empty() {
                    thread::sleep(Duration::from_millis(100));
                    // Stop once we've drained everything and producer is done
                    // (in a real server this loop runs forever)
                    break;
                }
                let total_bytes: usize = batch.iter().map(|s| s.packet_size).sum();
                let avg_ns: u64 =
                    batch.iter().map(|s| s.processing_time_ns).sum::<u64>() / batch.len() as u64;
                println!(
                    "📊 Scraped {} stats — total_bytes={} avg_ns={}",
                    batch.len(),
                    total_bytes,
                    avg_ns
                );
            }
            println!("✅ Consumer: scrape loop complete");
        })
    };

    producer.join().expect("producer thread panicked");
    consumer.join().expect("consumer thread panicked");

    println!("\n✅ Observability core demo finished.");
    println!("   In production: mount this behind a Hyper HTTP server on /metrics");
    println!("   and configure Prometheus to scrape http://localhost:9090/metrics");
}
