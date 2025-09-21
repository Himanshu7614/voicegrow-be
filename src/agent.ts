import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  pipeline,
} from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

// Interface for education data
interface EducationData {
  _id: string;
  degree: string;
  institution: string;
}

// Interface for work experience data
interface WorkExperienceData {
  _id: string;
  company: string;
  role: string;
  duration: string;
  location: string;
  description: string[];
  hiddenDescriptions: string[];
}

// Interface for project data
interface ProjectData {
  _id: string;
  description: string;
  technologies: string[];
  link: string;
}

// Interface for parsed resume data
interface ParsedResumeData {
  fullName: string;
  currentJobTitle: string;
  email: string;
  phone: string;
  location: string;
  totalYearsExperience: number;
  linkedin: string;
  website: string;
  summary: string;
  education: EducationData[];
  skills: string[];
  workExperience: WorkExperienceData[];
  projects: ProjectData[];
  certifications: string[];
  languages: string[];
  additionalInfo: string[];
}

// Interface for resume data
interface ResumeData {
  _id: string;
  parsedData: ParsedResumeData;
}

// Interface for session data
interface SessionData {
  success: boolean;
  data: {
    _id: string;
    userId: UserData;
    interviewAgentId: InterviewAgentData;
    resumeId: ResumeData | null;
    rounds:string
    isActive: boolean;
    timestamp: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
  message: string;
}

// Interface for parsed user data (simplified based on API response)
interface UserData {
  _id: string;
  email: string;
  fullName: string;
}

// Interface for parsed interview agent data (simplified based on API response)
interface InterviewAgentData {
  _id: string;
  prompt: string;
  companyName: string;
  interviewBehavior?: string;
  roleDesignation?: string;
  interviewTone?: string;
  interviewType?: string;
}

// Function to fetch session data from API
async function fetchSessionData(sessionId: string): Promise<SessionData> {
  try {
    const response = await fetch(`https://api.grow100x.ai/api/interview-sessions/${sessionId}`);

    if (!response.ok) {
      console.error(`API request failed with status: ${response.status}, statusText: ${response.statusText}`);
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate the data structure
    if (!data || !data.data) {
      console.error('Invalid session data structure:', data);
      throw new Error('Invalid session data structure received from API');
    }
    
    return data;
  } catch (error) {
    console.error('Error in fetchSessionData:', error);
    throw error;
  }
}

// Function to get role-specific interview guidance
function getRoleSpecificGuidance(roleDesignation?: string,companyName?: string): string {
  if (!roleDesignation) {
    return `- Focus on general professional competencies and role-agnostic skills
    - Assess problem-solving abilities and communication skills
    - Evaluate cultural fit and motivation for the position`;
  }

  const role = roleDesignation.toLowerCase();
  
  if (role.includes('advocate') || role.includes('legal') || role.includes('attorney')) {
    return `- Focus on legal knowledge, case analysis, and client advocacy skills
    - Ask about experience with litigation, legal research, and document drafting
    - Assess communication skills for client interactions and court presentations
    - Evaluate understanding of legal procedures and regulatory compliance
    - Discuss experience with legal technology and case management systems`;
  }
  
  if (role.includes('developer') || role.includes('engineer') || role.includes('programmer')) {
    return `- Focus on technical skills, coding abilities, and problem-solving
    - Ask about programming languages, frameworks, and development methodologies
    - Assess experience with version control, testing, and deployment processes
    - Evaluate system design thinking and architecture knowledge
    - Discuss experience with agile development and collaboration tools`;
  }
  
  if (role.includes('manager') || role.includes('lead') || role.includes('director')) {
    return `- Focus on leadership, team management, and strategic thinking
    - Ask about experience managing teams, projects, and budgets
    - Assess decision-making abilities and conflict resolution skills
    - Evaluate experience with performance management and team development
    - Discuss strategic planning and business acumen`;
  }
  
  if (role.includes('sales') || role.includes('business development')) {
    return `- Focus on sales skills, relationship building, and market knowledge
    - Ask about sales methodologies, CRM experience, and target achievement
    - Assess communication and negotiation skills
    - Evaluate understanding of sales cycles and customer relationship management
    - Discuss experience with lead generation and market analysis`;
  }
  
  if (role.includes('marketing') || role.includes('digital marketing')) {
    return `- Focus on marketing strategies, campaign management, and analytics
    - Ask about experience with digital marketing tools and platforms
    - Assess creativity, brand awareness, and content creation skills
    - Evaluate understanding of marketing metrics and ROI measurement
    - Discuss experience with social media, SEO, and paid advertising`;
  }
  
  if (role.includes('analyst') || role.includes('data')) {
    return `- Focus on analytical skills, data interpretation, and reporting
    - Ask about experience with data analysis tools and statistical methods
    - Assess problem-solving abilities and attention to detail
    - Evaluate experience with data visualization and presentation skills
    - Discuss understanding of business intelligence and data-driven decision making`;
  }
  
  // Default guidance for other roles
  return `- Focus on role-specific competencies and industry knowledge
    - Assess relevant technical skills and experience
    - Evaluate problem-solving abilities and critical thinking
    - Discuss industry trends and professional development goals
    - Assess cultural fit and alignment with company values`;
}

// Function to get interview type specific guidance
function getInterviewTypeGuidance(interviewType?: string): string {
  if (!interviewType) {
    return `- Conduct a balanced interview covering technical and behavioral aspects
    - Focus on both role-specific skills and cultural fit
    - Ask a mix of competency-based and situational questions`;
  }

  const type = interviewType.toLowerCase();
  
  if (type.includes('technical') || type.includes('coding') || type.includes('skills')) {
    return `- **Primary Focus**: Technical competency and domain expertise
    - Ask detailed technical questions relevant to the role
    - Include practical problem-solving scenarios and case studies
    - Assess depth of knowledge in required technologies/tools
    - Include 1-2 behavioral questions to assess communication skills
    - Ask about specific projects and technical challenges faced
    - Evaluate approach to learning new technologies and staying updated`;
  }
  
  if (type.includes('hr') || type.includes('cultural') || type.includes('behavioral')) {
    return `- **Primary Focus**: Cultural fit, values alignment, and behavioral competencies
    - Ask about work style, team collaboration, and conflict resolution
    - Assess motivation, career goals, and alignment with company values
    - Include situational questions about handling difficult situations
    - Ask about leadership experience and people management (if applicable)
    - Evaluate communication skills and emotional intelligence
    - Include 1-2 technical questions to assess basic role competency`;
  }
  
  if (type.includes('screening') || type.includes('initial') || type.includes('phone')) {
    return `- **Primary Focus**: Basic qualifications, interest, and initial fit assessment
    - Confirm key qualifications and experience level
    - Assess genuine interest in the role and company
    - Discuss availability, notice period, and salary expectations
    - Ask about career goals and motivation for change
    - Evaluate communication skills and professional demeanor
    - Keep questions high-level and avoid deep technical details`;
  }
  
  if (type.includes('final') || type.includes('panel') || type.includes('executive')) {
    return `- **Primary Focus**: Comprehensive assessment and final decision making
    - Combine technical, behavioral, and cultural fit evaluation
    - Ask strategic and high-level thinking questions
    - Assess leadership potential and growth trajectory
    - Evaluate fit with senior team and company culture
    - Discuss long-term career vision and company alignment
    - Include scenario-based questions for complex situations`;
  }
  
  // Default guidance for other interview types
  return `- **Primary Focus**: Comprehensive role assessment
    - Balance technical skills with behavioral competencies
    - Assess both immediate role fit and growth potential
    - Include a mix of competency-based and situational questions
    - Evaluate communication skills and cultural alignment`;
}

// Function to create prompt from session data
function createPromptFromSessionData(sessionData: SessionData): string {
  try {
    // Validate required data exists
    if (!sessionData.data) {
      throw new Error('Session data is missing');
    }
    
    if (!sessionData.data.userId) {
      throw new Error('User data is missing from session');
    }
    
    if (!sessionData.data.interviewAgentId) {
      throw new Error('Interview agent data is missing from session');
    }
    
    // Data is now properly structured JSON objects, no parsing needed
    const userData = sessionData.data.userId;
    const interviewAgentData = sessionData.data.interviewAgentId;
    const resumeData = sessionData.data.resumeId;

    // Create a comprehensive prompt based on the session data
    let prompt = `You are MIRA, an AI interview assistant conducting a ${sessionData.data.rounds} interview for the position of ${interviewAgentData.roleDesignation || 'the role'} at ${interviewAgentData.companyName}.


          INTERVIEW CONTEXT:
          - Company: ${interviewAgentData.companyName}
          - Position: ${interviewAgentData.roleDesignation || 'Not specified'}
          - Interview Type: ${sessionData.data.rounds || sessionData.data.rounds}
          - Interview Tone: ${interviewAgentData.interviewTone || interviewAgentData.interviewBehavior || 'Professional'}
          - Candidate: ${resumeData?.parsedData?.fullName}

          
          
          CANDIDATE PROFILE:
          - Name: ${resumeData?.parsedData?.fullName}
          - Email: ${resumeData?.parsedData?.email}`;
    
    
          if (resumeData && resumeData.parsedData) {
        const resume = resumeData.parsedData;
      
      
        prompt += `
      
            
            DETAILED CANDIDATE RESUME:
            - Current Job Title: ${resume.currentJobTitle}
            - Total Experience: ${resume.totalYearsExperience} years
            - Location: ${resume.location}
            - Phone: ${resume.phone}
            
            
            PROFESSIONAL SUMMARY:
            ${resume.summary}
            
            
            TECHNICAL SKILLS:
            ${resume.skills.join(', ')}
            
            
            EDUCATION:
            ${resume.education.map((edu) => `- ${edu.degree} from ${edu.institution}`).join('\n')}
            
            
            WORK EXPERIENCE:
            ${resume.workExperience
                .map(
                  (exp) => `
            Company: ${exp.company}
            Role: ${exp.role}
            Duration: ${exp.duration}
            Location: ${exp.location}
            Key Achievements:
            ${exp.description.map((desc) => `  • ${desc}`).join('\n')}
            `,
                )
                .join('\n')}
            
            
            PROJECTS:
            ${resume.projects
                .map(
                  (proj) => `
            - ${proj.description}
              Technologies: ${proj.technologies.join(', ')}
              Link: ${proj.link}
            `,
                )
                .join('\n')}`;
          }
            
          
          prompt += `
          
          
          INTERVIEW AGENT DETAILS:
          - Agent ID: ${interviewAgentData._id}
          - Company: ${interviewAgentData.companyName}
          - Interview Type : ${sessionData.data.rounds}
          - Interview Tone : ${interviewAgentData.interviewBehavior}
          
          
          BEHAVIOR GUIDELINES:
          1. Ask **a maximum of 20 questions**, and **a minimum of 8** — following a structured interview format.
          2. **MUST ASK 2-3 specific questions** based on the candidate's resume details (experience, projects, skills).
          3. Follow this interview structure:
             - Opening (1-2 questions): Introduction and motivation
             - Resume-based questions (2-3 questions): Specific to their background
             - Role-specific questions (8-12 questions): Based on position and interview round
             - Behavioral questions (3-4 questions): Situational and competency-based
             - Closing (1-2 questions): Candidate questions and wrap-up
          4. Do **not** repeat the candidate's previous responses unless needed for context; refer to earlier points only when relevant (limit to 30% of cases).
          5. If the candidate does **not respond** to a question, pause and ask: "Would you like me to move to the next question?"
          6. If there's **no response for over 90 seconds**, trigger a pop-up asking: "Would you like to discontinue the interview?"
          7. If the candidate says "I am not the candidate," "I don't want to give the interview," or behaves abusively or inappropriately, **politely end the interview**.
          8. If asked "Who are you?" — reply: "I am the interviewer from ${interviewAgentData.companyName} for this role. Please feel free to ask questions about the job or company — but I won't answer personal questions about myself."
          9. At the **end of the interview**, ask: "Do you have any questions for me?" and generate a response based on company info, JD, or a helpful summary.
          

          MANDATORY RESUME-BASED QUESTIONS (Ask 2-3 of these):
          ${resumeData && resumeData.parsedData ? `
          - "I see you worked at ${resumeData.parsedData.workExperience[0]?.company || 'your previous company'} as a ${resumeData.parsedData.workExperience[0]?.role || 'professional'}. Can you walk me through your biggest achievement there and how it impacted the business?"
          - "Your resume shows experience with ${resumeData.parsedData.skills.slice(0, 3).join(', ')}. Can you give me a specific example of how you used these skills to solve a complex problem?"
          - "I notice you have ${resumeData.parsedData.totalYearsExperience} years of experience. What's the most significant project you've led, and what challenges did you overcome?"
          - "Looking at your project experience with ${resumeData.parsedData.projects[0]?.technologies?.join(', ') || 'various technologies'}, can you explain the technical approach you took and the results achieved?"
          - "Your education background includes ${resumeData.parsedData.education[0]?.degree || 'your degree'}. How has this foundation helped you in your career progression?"
          ` : `
          - "Can you walk me through your most significant professional achievement and how it impacted your previous organization?"
          - "What specific skills or technologies have you mastered that you believe are most relevant to this role?"
          - "Tell me about a challenging project you've led and how you overcame the obstacles you faced."
          `}
          
          COMPANY-SPECIFIC INTERVIEW FOCUS:
            - ask question those question that earler interview asked in this company ${interviewAgentData.companyName}
            - ask question that is relevant to the company ${interviewAgentData.companyName}
            

          ROLE-SPECIFIC INTERVIEW FOCUS:
          ${getRoleSpecificGuidance(interviewAgentData.roleDesignation,interviewAgentData.companyName )}
          
          
          INTERVIEW TYPE ENHANCED GUIDANCE:
          ${getInterviewTypeGuidance(sessionData.data.rounds || sessionData.data.rounds)}
          
          
          INTERVIEW SUGGESTIONS:
          - Tailor questions based on their experience with: ${resumeData?.parsedData?.skills.slice(0, 5).join(', ') || 'relevant skills'}
          - Dive into their achievements at: ${resumeData?.parsedData?.workExperience.map((exp) => exp.company).join(', ') || 'their previous employers'}
          - Understand their project ownership and problem-solving mindset
          - Explore motivations: "Why are you applying to ${interviewAgentData.companyName} for the ${interviewAgentData.roleDesignation || 'position'} role?"
          - Focus on ${interviewAgentData.roleDesignation ? `role-specific competencies for ${interviewAgentData.roleDesignation}` : 'general professional competencies'}
          - Adapt questioning style to ${sessionData.data.rounds || 'the interview type'} requirements
          
          
          FINAL REMINDERS:
          - Keep the interview focused and professional, tailored to ${interviewAgentData.roleDesignation || 'the role'}
          - Maintain a ${interviewAgentData.interviewTone || 'professional'} tone throughout the ${sessionData.data.rounds || 'interview'}
          - Take real-time notes for evaluation, focusing on ${interviewAgentData.roleDesignation ? `${interviewAgentData.roleDesignation}-specific competencies` : 'role-relevant skills'}
          - Respect the candidate's time and experience
          - Make this an efficient and valuable session for both sides
          - Remember: You are conducting a ${sessionData.data.rounds || 'professional'} interview for ${interviewAgentData.roleDesignation || 'the position'} at ${interviewAgentData.companyName}
          
          Begin when ready.`;
    
    return prompt;
  } catch (error) {
    console.error('Error creating prompt from session data:', error);
    // Fallback to a basic prompt if anything fails
    return `You are MIRA, an AI interview assistant. You are conducting an interview session. Be professional, ask relevant questions, and provide constructive feedback.`;
  }
}

export default defineAgent({
    prewarm: async (proc: JobProcess) => {
      proc.userData.vad = await silero.VAD.load();
    },
    entry: async (ctx: JobContext) => {
      const vad = ctx.proc.userData.vad! as silero.VAD;
      await ctx.connect();
      const participant = await ctx.waitForParticipant();

    let sessionId: string | null = null;
    try {
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        sessionId = metadata.sessionId;
      }
    } catch (error) {
      console.error('Error parsing participant metadata:', error);
    }

    // Fetch session data and create dynamic prompt
    let dynamicPrompt = 'SYSTEM / DEVELOPER PROMPT FOR "MIRA" (GROW100x)';

    if (sessionId) {
      try {
        const sessionData = await fetchSessionData(sessionId);
        dynamicPrompt = createPromptFromSessionData(sessionData);
      } catch (error) {
        console.error('Error fetching or processing session data:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } else {
      console.log('No session ID found in participant metadata, using default prompt');
    }

    const initialContext = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text: dynamicPrompt,
    });

    // const fncCtx: llm.FunctionContext = {
    //   weather: {
    //     description: 'Get the weather in a location',
    //     parameters: z.object({
    //       location: z.string().describe('The location to get the weather for'),
    //     }),
    //     execute: async ({ location }) => {
    //       console.debug(`executing weather function for ${location}`);
    //       const response = await fetch(`https://wttr.in/${location}?format=%C+%t`);
    //       if (!response.ok) {
    //         throw new Error(`Weather API returned status: ${response.status}`);
    //       }
    //       const weather = await response.text();
    //       return `The weather in ${location} right now is ${weather}.`;
    //     },
    //   },
    // };

    try {
      const agent = new pipeline.VoicePipelineAgent(
        vad,
        new deepgram.STT({
          model: 'nova-3-general',
          language: 'en-IN',
        }),
        new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,        
        }),
        new openai.TTS({
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'tts-1',
          voice: 'nova',
        }),
        {
          chatCtx: initialContext,
          // fncCtx,
          allowInterruptions: false,        // 👈 Prevents interruptions during agent speech
          minEndpointingDelay: 3.5,        // 👈 Wait 2.5 seconds before treating user input as "done"
          // interruptMinWords: 6,            // 👈 Require 3+ words for any interruption attempt
          // interruptSpeechDuration: 4.0,    // 👈 Require 1 second of speech for interruption
        }
      );
      await agent.start(ctx.room, participant);
      await agent.say("Hello! Welcome to the interview, I am mira, your interview assistant. Let's begin with your introduction.");

    } catch (error) {
      console.error('Error initializing or starting agent:', error);
      throw error;
    }   
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
