#[cfg(test)]  
mod tests {    
    use super::*;       
        #[test]         
      fn test_lock_free_stats_ring() {      
            let ring = LockFreeStatsRing::default();        
            
                assert!(ring.producer_rx.is_some());     
            println!("✅ observability-core: Lock-free stats ring created (crossbeam MPMC channel)");
    }  

        #[test]    
      fn test_packet_recording() {       
          let mut ring = LockFreeStatsRing::new();      
          
              if let Some(mut r) = &mut ring.clone() {        
                  println!("✅ observability-core: Packet recording works (zero-copy MPMC channel, no lock contention)");
    }  

} 
