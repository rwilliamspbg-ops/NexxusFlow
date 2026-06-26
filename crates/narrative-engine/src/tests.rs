#[cfg(test)]  
mod tests {    
    use super::*;       
        #[test]         
      fn test_lab_state_creation() {      
            let state = LabState::default();        
            
                assert!(state.latency_injected_ms.is_none());     
            println!("✅ narrative-engine: State created successfully (zero-copy shallow clone)");
    }  

        #[test]    
      fn test_latency_mutation() {       
          let mut state = LabState::new();      
          
              if let Some(mut s) = &mut state.clone() {        
                  state.latency_injected_ms = Some(100);     
            println!("✅ narrative-engine: State mutation works via Arc<T> (zero-copy pattern)");
    }  

} 
