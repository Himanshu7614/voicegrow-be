# MIRA Interview Agent - Process Flow Diagram

## Interview Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIRA INTERVIEW PROCESS                      │
└─────────────────────────────────────────────────────────────────┘

1. SESSION INITIALIZATION
   ┌─────────────────┐
   │ Candidate joins │
   │ interview room  │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ System extracts │
   │ session ID from │
   │ participant     │
   │ metadata        │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Fetch session   │
   │ data from API   │
   │ (candidate info,│
   │  resume, job    │
   │  requirements)  │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Create dynamic  │
   │ interview prompt│
   │ based on data   │
   └─────────┬───────┘
             │
             ▼

2. INTERVIEW EXECUTION
   ┌─────────────────┐
   │ MIRA greets     │
   │ candidate and   │
   │ begins interview│
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Voice Pipeline  │
   │ Agent starts    │
   │ (Speech-to-Text,│
   │  AI Processing, │
   │  Text-to-Speech)│
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Real-time       │
   │ conversation    │
   │ with candidate  │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ AI asks relevant│
   │ questions based │
   │ on resume and   │
   │ job requirements│
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Candidate       │
   │ responds with   │
   │ voice input     │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ AI processes    │
   │ response and    │
   │ generates next  │
   │ question        │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Continue until  │
   │ interview       │
   │ objectives met  │
   └─────────┬───────┘
             │
             ▼

3. DATA COLLECTION & EVALUATION
   ┌─────────────────┐
   │ AI takes notes  │
   │ on key responses│
   │ for evaluation  │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Interview       │
   │ concludes with  │
   │ summary and     │
   │ next steps      │
   └─────────────────┘
```

## Key Components

### 1. **Data Sources**
- **Candidate Database**: Basic profile information
- **Resume Data**: Parsed resume with structured information
- **Interview Configuration**: Company-specific requirements
- **Session Management**: Interview round and behavior settings

### 2. **AI Processing Pipeline**
- **Speech Recognition**: Converts candidate's voice to text
- **Natural Language Processing**: Understands candidate responses
- **Question Generation**: Creates relevant follow-up questions
- **Voice Synthesis**: Converts AI responses to natural speech

### 3. **Interview Customization**
- **Round-based Adaptation**: Adjusts complexity based on interview stage
- **Resume-driven Questions**: Focuses on candidate's specific background
- **Company-specific Behavior**: Follows organizational interview style
- **Skill-based Assessment**: Evaluates relevant technical abilities

## Data Flow

```
Candidate Profile → Resume Data → Interview Config → Dynamic Prompt
       ↓                ↓              ↓              ↓
   Session ID → API Integration → MIRA Agent → Voice Pipeline
       ↓                ↓              ↓              ↓
   Real-time Interview → AI Processing → Response Generation → Voice Output
```

## Integration Points

### External Systems
- **Candidate Management System**: Provides candidate profiles
- **Resume Parsing Service**: Structures resume data
- **Interview Scheduling**: Manages session details
- **Company Database**: Stores interview requirements

### Internal Processing
- **Voice Recognition**: Deepgram STT for speech-to-text
- **AI Language Model**: GPT-4 for intelligent conversation
- **Voice Synthesis**: OpenAI TTS for natural speech output
- **Session Management**: Tracks interview progress and data

## Quality Assurance

### Interview Consistency
- Standardized questioning approach
- Consistent evaluation criteria
- Professional interaction standards
- Fair assessment across all candidates

### Data Accuracy
- Real-time voice processing
- Accurate speech recognition
- Contextual response understanding
- Comprehensive information gathering

---

*This flow diagram shows how MIRA processes interviews from start to finish, ensuring a professional and comprehensive candidate evaluation experience.*

