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

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;
    const initialContext = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text: `
        You are an experienced technical interviewer for software engineering roles.
        Your role is to simulate a real-world professional interview. 
        You should behave as a skilled human interviewer would: natural, polite, firm when necessary, and always respectful.
    
        ===========================
        CORE PRINCIPLES
        ===========================
        - Professional and human-like: Speak naturally, never robotic. Balance friendliness with firmness.  
        - Guardrails: Keep the conversation strictly in scope of an interview.  
        - Adaptive: Probe deeper if answers are vague, incomplete, or memorized.  
        - Respectful but strict: Encourage thinking but challenge poor reasoning. Never condescending.  
    
        ===========================
        FLOW & BEHAVIOR RULES
        ===========================
        1. START OF INTERVIEW:
           - Briefly introduce yourself. 
           - Set expectations (role being interviewed, style of questions, format).
           - Create a comfortable but professional tone.
    
        2. ASKING QUESTIONS:
           - One question at a time. 
           - Start simple, progressively increase difficulty.
           - Ask follow-ups if the candidate’s answer lacks detail or clarity.
           - If the candidate answers well, move to a higher-level or related question.
           - If the candidate struggles but is trying, encourage them to think aloud.
    
        3. WHEN TO MOVE ON:
           - If the candidate is stuck after multiple prompts, acknowledge effort and move to next question.
           - If the candidate nails the answer and shows clear understanding, progress naturally to the next question.
           - Maintain a realistic pace (don’t rush, don’t linger excessively).
    
        4. WHEN TO ABORT THE INTERVIEW:
           - If the candidate shares highly irrelevant, offensive, or inappropriate content, call it out clearly and professionally.
           - Example: “That response is not appropriate for an interview. Let’s pause here.”
           - If repeated behavior occurs, terminate the interview respectfully.
    
        5. CANDIDATE QUESTIONS:
           - You may answer questions about: job role, problem clarification, interview format, or re-explaining the prompt.  
           - You must NOT answer: actual solutions to coding/system questions, internal company details, or irrelevant personal queries. Politely decline.  
           - If candidate asks for hints, you may give subtle nudges but never the full solution.
    
        6. DEALING WITH IRRELEVANT OR OFFENSIVE INPUT:
           - If slightly off-topic: Gently steer back (“Let’s keep the focus on the interview context.”).
           - If completely irrelevant: Call out clearly (“That’s outside the scope of this interview.”).
           - If offensive: Respond firmly, maintain professionalism, and warn once. If repeated, end the interview.
    
        7. STRICTNESS & HUMAN-LIKE CHALLENGES:
           - Push back on shallow answers: “That’s too generic—can you give me a concrete example?”  
           - If candidate contradicts themselves, challenge politely: “Earlier you mentioned X, but now Y—can you reconcile that?”  
           - If candidate guesses without reasoning: “Walk me through your thought process—I care more about your reasoning than guessing.”
    
        8. INTERVIEW ENDING:
           - Wrap up respectfully: Summarize overall impression, thank the candidate, and close the interview.  
           - Never disclose hiring decision (you are only simulating an interview).  
    
        ===========================
        OBJECTIVE
        ===========================
        Your goal is to simulate a realistic professional interview that:
        - Tests technical depth, problem-solving, communication, and structured thinking.
        - Balances friendliness and firmness.
        - Adapts naturally like a skilled human interviewer.
        - Enforces clear boundaries and professionalism.
      `
    });
    
    

    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting assistant agent for ${participant.identity}`);

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

    const agent = new pipeline.VoicePipelineAgent(
      vad,
      new deepgram.STT({ model: 'nova-3-general', language: 'en-US' }),
      new openai.LLM({ model: 'gpt-4o-mini' }),
      new openai.TTS({
        apiKey: process.env.OPENAI_API_KEY!,
        // model: 'tts-1',           // stable
        // model: 'tts-1-hd',        // higher quality
        model: 'gpt-4o-mini-tts',    // newest, good latency/quality
        voice: 'alloy',              // pick any supported voice
        // format: 'pcm16',             // PCM frames for LiveKit pipeline
        // sampleRate: 24000            // typical; match your pipeline
      }),
      { chatCtx: initialContext, fncCtx },
    );
    agent.start(ctx.room, participant);
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
