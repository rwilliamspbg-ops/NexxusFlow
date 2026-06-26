//! Packet Handler Binary - AF_XDP Hot Path Demo for High-Throughput Testing

use afxdp_lab::{AF_XDPLabHandler, PacketError};  

fn main() {    
    let handler = AF_XDPLabHandler::new();   
      
    println!("🚀 AF_XDP Packet Handler Initialized");       
    println!("✅ Hardware detection complete (simulated mode if no NIC)");       
            
    // Example packet processing loop - zero-copy handling
    let sample_packets: &[u8] = &vec![0; 64]; 
    
    match handler.handle_packet(sample_packets) {        
        Ok(_) => println!("✅ Packet processed successfully (zero-copy)"),      
        Err(PacketError::IncompletePacket) => eprintln!("❌ Incomplete packet received"),      
        Err(PacketError::ParseFailure) => eprintln!("❌ Parse failure in hot path"),      
    }
}  
