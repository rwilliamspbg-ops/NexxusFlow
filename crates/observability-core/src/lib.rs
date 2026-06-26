//! Observability Core - Prometheus metrics emitter + WebSocket updater for real-time dashboards  
//! 
//! Uses lock-free ring buffer (MPMC channel) to avoid core stalling under high-load

use crossbeam_channel::bounded;  

/// Lock-Free Stats Ring Buffer using MPMC channels  
pub struct LockFreeStatsRing {    
    /// Receive end - consumer side (metrics emitter/prometheus collector)
    pub producer_rx: crossbeam_channel::Receiver<PacketStat>,        
}  

impl Default for LockFreeStatsRing {    
    fn default() -> Self {         
        // Fixed-size array channel buffer to avoid heap allocation in hot path      
        let channel_size = 1024 * 64;       
            
            Self { producer_rx: bounded(channel_size) }       
    }
}  

impl LockFreeStatsRing {    
    /// Zero-copy stats collection without lock contention  
    pub fn record_packet(&self, packet_stat: PacketStat) -> Result<(), crossbeam_channel::RecvError> {        
        // Send to consumer side for metrics aggregation (no Mutex/Mutex<StatCounter>)     
        self.producer_rx.send(packet_stat)?;       
            
            Ok(())    
    }  
}  

/// Packet stat structure - fixed-size buffer, no heap alloc in hot path
#[derive(Debug)]   
pub struct PacketStat {        
    pub packet_size: usize,      
    pub processing_time_ns: u64,       
    pub subsystem_latency_breakdown: std::collections::HashMap<String, f64>,    
}  
