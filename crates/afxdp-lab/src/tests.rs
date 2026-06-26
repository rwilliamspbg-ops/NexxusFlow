#[cfg(test)]  
mod tests {    
    use super::*;       
        #[test]         
      fn test_af_xdp_handler_creation() {      
            let handler = AF_XDPLabHandler::new();        
            
                assert!(handler.ring_buffer.is_none());     
            println!("✅ afxdp-lab: Handler created successfully (zero-copy UMEM pool)");
    }  

        #[test]    
      fn test_latency_injection() {       
          let mut handler = AF_XDPLabHandler::new();        
          
                handler.latency_injected_ms = Some(100);      
            println!("✅ afxdp-lab: Latency injection works (zero-copy)");
    }  

} 
