// packages/types-shared/src/lab-chapter.ts  
import { z } from "zod";

export const labChapterSchema = z.object({    
  id: z.string(),                 // e.g., "path-1-sovereign-foundations.chapter-jwt-auth"        
  title: z.string(),              // Display name for UI         
  description: z.string(),        // Intro narrative text      
  prereqs: z.array(z.string()),   // ["jwt-basics"] or []       
  simpleModeHint: z.boolean(),    // Enable/disable advanced features
  steps: z.array(        
    z.object({          
      id: z.string(),             // Step identifier (e.g., "setup-monitoring")        
      type: z.enum(["narrative", "command", "lab-run", "decision"]),       
      narrative: z.optional(z.string()),        // Text for UI cards      
      commands: z.array(z.object({          
        exec: z.string(),                   // Actual command to run      
        description: z.string()             // What it does & why here        
      })),
      decisionPoints: z.optional(            
        z.array(z.object({         
          question: z.string(),             
          options: z.array(z.object({       
            label: z.string(),           
            payload: z.union([              
              z.boolean(),                  
              z.number()                    
            ])          
          }))        
        })),
      ),      
      expectedOutcome: z.string().optional(),   // For grading/checking results      
      reflectionPrompt: z.optional(z.string()) // Post-lab reflection text    
    })  
  )  
});

export type LabChapter = z.infer<typeof labChapterSchema>;  

// Example usage for "Deploy JWT Auth Stack" chapter
const jwtAuthChapterExample: Partial<LabChapter> = {
  id: "path-1-sovereign-foundations.chapter-jwt-auth",        
  title: "JWT Authentication Stack Deployment",      
  description: "Learn to secure your backend services with JSON Web Tokens.",    
  prereqs: [],       
  simpleModeHint: false,           
  steps: [        
    {          
      id: "narrative-intro",         
      type: "narrative",      
      narrative: "Before we start deploying the JWT auth stack...",       
      decisionPoints: undefined,
      expectedOutcome: null,
      reflectionPrompt: "What are the benefits of using JWT tokens vs session cookies?",    
    },        
    {          
      id: "command-docker-compose-jwt-stack",         
      type: "command",      
      commands: [            
        {              
          exec: "docker compose up -d jwt-auth-backend",       
          description: "Starts the backend service with JWT middleware enabled."      
        }
      ],    
    },        
  ]  
};
