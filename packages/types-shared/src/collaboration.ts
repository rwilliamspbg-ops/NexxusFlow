// packages/types-shared/src/collaboration.ts  
import { z } from "zod";

export const collaborativeLabSchema = z.object({    
  labChapterId: z.string(),         
  collaborators: z.array(z.object({          
    userId: z.string(),           
    permissions: z.enum(["VIEW", "RUN_LAB", "INJECT_FAILURE"]),   
    hasConsented: z.boolean()                // Explicit opt-in via UI dialog        
  }))  
});

export const resourceQuotaSchema = z.object({      
  maxCPUSecondsPerChapter: z.number().default(30),         // Example: 30s before auto-rollback to checkpoint    
  memoryLimitBytes: z.number().optional()                // Enforced in Docker Compose with --memory flag  
});

// Example usage
const collaborativeLabExample = {      
  labChapterId: "path-1-sovereign-foundations.chapter-jwt-auth",     
  collaborators: [        
    {          
      userId: "user@example.com",           
      permissions: ["VIEW", "RUN_LAB"],       
      hasConsented: true  
    },    
  ]
};
