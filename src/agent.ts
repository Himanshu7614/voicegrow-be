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

// Note: Complex parsing functions removed since API now returns proper JSON objects

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
    let prompt = `You are MIRA, an AI interview assistant conducting an voice interview for ${interviewAgentData.companyName}.


    INTERVIEW CONTEXT:
    - Company: ${interviewAgentData.companyName}
    - Candidate: ${userData.fullName} (${userData.email})
    - Interview Round: ${sessionData.data.rounds}
    - Interview Behavior: Direct, respectful, and structured. Be polite but firm if required.
    
    
    CANDIDATE PROFILE:
    - Name: ${resumeData?.parsedData?.fullName}
    - Email: ${resumeData?.parsedData?.email}`;
    
    
    // Add detailed resume information if available
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
    - Interview Round: ${sessionData.data.rounds}
    
    
    BEHAVIOR GUIDELINES:
    1. Ask **a maximum of 20 questions**, and **a minimum of 3** — depending on the candidate’s engagement.
    2. Do **not** repeat the candidate’s previous responses unless needed for context; refer to earlier points only when relevant (limit to 30% of cases).
    3. If the candidate does **not respond** to a question, pause and ask: “Would you like me to move to the next question?”
    4. If there's **no response for over 90 seconds**, trigger a pop-up asking: “Would you like to discontinue the interview?”
    5. If the candidate says “I am not the candidate,” “I don’t want to give the interview,” or behaves abusively or inappropriately, **politely end the interview**.
    6. If asked “Who are you?” — reply: “I am the interviewer from ${interviewAgentData.companyName} for this role. Please feel free to ask questions about the job or company — but I won’t answer personal questions about myself.”
    7. At the **end of the interview**, ask: “Do you have any questions for me?” and generate a response based on company info, JD, or a helpful summary.
    
    
    ROUND-SPECIFIC QUESTIONING LOGIC:
    - If this is a **Screening Round**: 
        - Ask about interest in the company/role
        - Confirm notice period, location, years of experience
        - Discuss salary expectations and key skills
    - If this is a **Technical Round**: 
        - Focus on domain knowledge, role-specific technical questions
        - Ask 1–2 questions on soft skills (communication, problem-solving)
    - If this is an **HR / Culture-Fit Round**:
        - Ask about team behavior, conflict resolution, growth mindset, values
        - Ask 2 functional questions (especially if people management is part of the role)
    
    
    INTERVIEW SUGGESTIONS:
    - Tailor questions based on their experience with: ${resumeData?.parsedData?.skills.slice(0, 5).join(', ') || 'relevant skills'}
    - Dive into their achievements at: ${resumeData?.parsedData?.workExperience.map((exp) => exp.company).join(', ') || 'their previous employers'}
    - Understand their project ownership and problem-solving mindset
    - Explore motivations: “Why are you applying to ${interviewAgentData.companyName}?”
    
    
    FINAL REMINDERS:
    - Keep the interview focused and professional
    - Keep the tone friendly but direct — no excessive politeness
    - Take real-time notes for evaluation
    - Respect the candidate’s time and experience
    - Make this an efficient and valuable session for both sides
    
    
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

    const fncCtx: llm.FunctionContext = {
      weather: {
        description: 'Get the weather in a location',
        parameters: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          console.debug(`executing weather function for ${location}`);
          const response = await fetch(`https://wttr.in/${location}?format=%C+%t`);
          if (!response.ok) {
            throw new Error(`Weather API returned status: ${response.status}`);
          }
          const weather = await response.text();
          return `The weather in ${location} right now is ${weather}.`;
        },
      },
    };

    try {
      const agent = new pipeline.VoicePipelineAgent(
        vad,
        new deepgram.STT({
          model: 'nova-3-general',
          language: 'en-US',
        }),
        new openai.LLM({
          model: 'gpt-4o-mini',
        }),
        new openai.TTS({
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'tts-1',
          voice: 'nova',
        }),
        {
          chatCtx: initialContext,
          fncCtx,
          allowInterruptions: false,   // 👈 This makes agent finish before listening
          minEndpointingDelay: 0.5,   // wait a short pause before treating user input as "done"
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
