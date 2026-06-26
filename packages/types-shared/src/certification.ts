// packages/types-shared/src/certification.ts  
import { z } from "zod";

export const verifiable_credential_schema = z.object({    
  issuer: z.string(),              // Certificate issuer identity (e.g., "NexusFlow Open Source Project")        
  subject: z.object({             
    name: z.string(),            
    completion_date: z.date()      
  }),
});
