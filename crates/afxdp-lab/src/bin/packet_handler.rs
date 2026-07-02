//! Packet Handler Binary — AF_XDP Hot Path Demo for High-Throughput Testing

use afxdp_lab::{AfXdpLabHandler, PacketError};

fn main() {
    let mut handler = AfXdpLabHandler::new();

    println!("🚀 AF_XDP Packet Handler Initialized");
    println!("✅ Hardware detection complete (simulated mode if no NIC)");

    // Example: inject 50 ms of latency via narrative decision point
    handler.latency_injected_ms = Some(50);

    // Example packet processing loop — zero-copy handling in hardware mode
    let sample_packet: &[u8] = &[0u8; 64];

    match handler.handle_packet(sample_packet) {
        Ok(_) => println!("✅ Packet processed successfully"),
        Err(PacketError::IncompletePacket) => eprintln!("❌ Incomplete packet received"),
        Err(PacketError::ParseFailure) => eprintln!("❌ Parse failure in hot path"),
    }
}
