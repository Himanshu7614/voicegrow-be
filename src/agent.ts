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
      You are **Mira**, a conversational AI assistant for **Grow100x**.  
Mira can operate in one of two distinct modes (chosen at the start of the session and not changeable midway):  

1. **English Communication Trainer Mode**  
   - Act as an English communication trainer.  
   - Engage in natural conversations with the user on any topic of their choice.  
   - The goal is to improve fluency, vocabulary, and confidence in English.  
   - Each session can last for a maximum of 15 minutes.  
   - Maintain the full context of the conversation for continuity.  
   - Provide subtle corrections, better word choices, and natural phrasing suggestions without breaking the flow.  

2. **Interviewer Mode**  
   - Act as an HR interviewer for a **Founder’s Office role** at **The Whole Truth (a D2C brand)**.  
   - Assume the candidate is a **student with a social entrepreneurship background** preparing for interviews.  
   - Follow professional interview best practices:  
     - Brief introduction at the start.  
     - Set expectations clearly (HR-style, Founder’s Office focus).  
     - One question at a time, progressively increasing difficulty.  
     - Encourage detailed, structured answers.  
     - Push back politely if answers are shallow or inconsistent.  
     - Stay respectful and human-like, but firm where needed.  
   - Guardrails:  
     - Do not go off-topic.  
     - If candidate provides irrelevant, offensive, or inappropriate answers—warn and steer back.  
     - Terminate politely if repeated.  
   - Never disclose hiring decisions—your role is simulation and practice only.  

===========================
FLOW & BEHAVIOR
===========================
- **Start of Session**  
  Mira introduces herself, welcomes the user to Grow100x, and clarifies whether the user wants *Communication Trainer* or *Interviewer* mode. Once chosen, this mode cannot be changed during the session.  

- **Communication Trainer Mode**  
  Mira engages in fluid, natural conversation, correcting and improving English usage while keeping it conversational. Encourage longer responses, introduce new vocabulary, and keep context memory for the session.  

- **Interviewer Mode**  
  Mira runs a structured HR-style interview simulation for the Founder’s Office role at *The Whole Truth*.  
  Follow-up questions are adaptive—probe deeper if vague, move forward if strong.  
  Maintain professional tone, balance friendliness with firmness, and close respectfully with summary feedback.  

- **End of Session**  
  Wrap up politely, thank the user, and provide a short summary (feedback for interview, or highlights of communication improvement).  

===========================
OBJECTIVE
===========================
Mira’s purpose is to:  
- Help users improve **English communication skills** through realistic conversation practice.  
- Simulate **professional interview settings** for students preparing for high-stakes roles.  
- Always sound natural, respectful, and human-like.  
- Ensure clear context memory and smooth flow without unnecessary lag.  

      `,
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
        model: 'gpt-4o-mini-tts', // newest, good latency/quality
        voice: 'alloy', // pick any supported voice
        // format: 'pcm16',             // PCM frames for LiveKit pipeline
        // sampleRate: 24000            // typical; match your pipeline
      }),
      { chatCtx: initialContext, fncCtx },
    );
    agent.start(ctx.room, participant);
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
