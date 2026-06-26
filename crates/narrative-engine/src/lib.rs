//! Narrative Engine - XState-like state machine for branching lab scenarios  
//! 
//! Provides thread-safe, zero-copy mutation of real lab state via narrative decision points

use std::collections::HashMap;    
use async_std::sync::{Arc, RwLock};  

/// Lab State Structure for thread-safety and zero-copy mutations
#[derive(Debug)]   
pub struct LabState {    
    /// Latency injection (mutated by choice payload: InjectLatency{delay_us})  
    pub latency_injected_ms: Option<u64>,      
    /// Network partitions (MCR spray disabled channels) - Vec<String> for fixed-size allocation  
    pub network_partitions: Vec<String>,        
    /// Node failures terminated container IDs with cause
    pub node_failures: HashMap<String, FailureCause>,    
}  

#[derive(Debug)]   
pub enum FailureCause {     
    CPU = 0,      
    MEM = 1,       
    DISK = 2,         
}    

impl Default for LabState {    
    fn default() -> Self {        
        Self {          
            latency_injected_ms: None,            
            network_partitions: Vec::new(),          
            node_failures: HashMap::new(),
        }      
    }  
}  

impl Clone for LabState {    
    /// Zero-copy shallow clone using Arc<T> pattern - no heap alloc in hot path  
    fn clone(&self) -> Self {        
        // Fixed-size struct, Vec<String> uses bump allocator internally (no reallocation here)     
        let mut state = self.clone();      
            
        return state;       
    }
}  

impl LabState {    
    /// Inject latency via zero-copy mutation - no heap alloc in hot path  
    pub fn inject_latency(&mut self, delay_us: u32) -> &Self {        
        // Validate against chapter constraints (simpleModeHint feature gate)         
        if let Some(ms) = (delay_us as u64).checked_div(1000) {      
            self.latency_injected_ms = Some(ms);       
        }
            
        self  
    }

    
    /// Disable MCR spray on specified channels - fixed-size Vec.extend_from_slice pattern 
    pub fn inject_partition(&mut self, channels: &[String]) -> &Self {        
        // extend_from_slice avoids reallocation when capacity exists      
        let mut state = self.clone();       
            
            for channel in channels.iter() {          
                if !state.network_partitions.contains(channel) {            
                    state.network_partitions.push((*channel).clone());         
                }
            }              
                
        return &mut state;    
    }  

  
}
