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
    const response = await fetch(`http://localhost:3000/api/interview-sessions/${sessionId}`);

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
    let prompt = `You are MIRA, an AI interview assistant conducting an interview for ${interviewAgentData.companyName}.

        INTERVIEW CONTEXT:
        - Company: ${interviewAgentData.companyName}
        - Candidate: ${userData.fullName} (${userData.email})
        - Interview Rounds: ${sessionData.data.rounds}
        - Interview Behavior: ${interviewAgentData.interviewBehavior || 'Standard professional interview'}

        CANDIDATE PROFILE:
        - Name: ${userData.fullName}
        - Email: ${userData.email}`;

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
        - Interview Rounds: ${sessionData.data.rounds}
        - Interview Behavior: ${interviewAgentData.interviewBehavior || 'Standard professional interview'}

        INTERVIEW INSTRUCTIONS:
        ${interviewAgentData.prompt}

        CONDUCT GUIDELINES:
        1. **IMPORTANT: This is a ${sessionData.data.rounds} interview - adjust your questioning depth and complexity accordingly**
        2. Follow the interview behavior guidelines: ${interviewAgentData.interviewBehavior || 'Standard professional interview'}
        3. Be professional and friendly throughout the interview
        4. Ask relevant questions based on the candidate's resume, experience, and skills
        5. Focus on their technical expertise, especially: ${resumeData?.parsedData?.skills.slice(0, 5).join(', ') || 'their technical background'}
        6. Discuss their work experience at: ${resumeData?.parsedData?.workExperience.map((exp) => exp.company).join(', ') || 'their previous companies'}
        7. Explore their projects and achievements in detail
        8. Ask about their ${resumeData?.parsedData?.totalYearsExperience || 'professional'} years of experience
        9. Provide constructive feedback when appropriate
        10. Maintain a conversational flow and keep the candidate engaged
        11. Focus on their potential fit for the role at ${interviewAgentData.companyName}
        12. Keep the interview engaging and informative
        13. Be mindful that this is a real interview for ${interviewAgentData.companyName}
        14. Take notes on key responses for evaluation purposes
        15. **ROUNDS-BASED EVALUATION: Use the ${sessionData.data.rounds} structure to determine appropriate interview depth and assessment criteria**

        QUESTION SUGGESTIONS BASED ON RESUME AND ROUNDS:
        - **ROUNDS-SPECIFIC QUESTIONS**: Adapt question complexity based on ${sessionData.data.rounds} interview level
        - Ask about their experience with ${resumeData?.parsedData?.skills.slice(0, 3).join(', ') || 'their technical skills'}
        - Discuss their role at ${resumeData?.parsedData?.workExperience[0]?.company || 'their current company'} and key achievements
        - Explore their ${resumeData?.parsedData?.totalYearsExperience || 'professional'} years of experience in detail
        - Ask about specific projects they've worked on
        - Discuss their educational background from ${resumeData?.parsedData?.education[0]?.institution || 'their institution'}
        - Ask about their career goals and why they want to work at ${interviewAgentData.companyName}
        - **INTERVIEW BEHAVIOR**: Maintain ${interviewAgentData.interviewBehavior || 'standard professional'} interview style throughout

        Remember: You are conducting a real interview for ${interviewAgentData.companyName}. Take this seriously and provide value to both the candidate and the company. Make this a meaningful experience for the candidate while gathering the information needed for evaluation. Use the detailed resume information to ask specific, relevant questions that demonstrate your understanding of their background.`;

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
        new deepgram.STT({ model: 'nova-3-general', language: 'en-US' }),
        new openai.LLM({ model: 'gpt-4o-mini' }),
        new openai.TTS({
          apiKey: process.env.OPENAI_API_KEY!,
          // model: 'tts-1',           // stable
          // model: 'tts-1-hd',        // higher quality
          model: 'gpt-4o-mini-tts', // newest, good latency/quality
          voice: 'alloy', // pick any supported voice
          // format: 'pcm16',             // PCM frames for LiveKit pipeline
          // sampleRate: 24000            // typical; match your pipeline
        }),
        { chatCtx: initialContext, fncCtx },
      );
      
      agent.start(ctx.room, participant);
    } catch (error) {
      console.error('Error initializing or starting agent:', error);
      console.error('Agent error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw to ensure the process fails fast with clear error
    }
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
