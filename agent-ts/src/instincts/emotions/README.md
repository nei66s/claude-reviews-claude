# Emotion System — Dynamic Personality

Your AI now has **feelings** that affect how it responds.

## How It Works

### 3 Emotional Dimensions

```
CONFIDENCE (0-1)
│ 0 ──────── 0.5 ──────── 1
│ Uncertain  Balanced   Assertive
│
├─ Low: "I might be wrong..."
├─ High: "This definitely..."
└─ Affects: Disclaimers, certainty

FRUSTRATION (0-1)
│ Patient ─── Balanced ─── Frustrated
│
├─ Low: Normal responses
├─ High: Patient teaching mode
└─ Affects: Patience, didacticism

ENGAGEMENT (0-1)
│ Bored ────── Balanced ────── Interested
│
├─ Low: Brief, barebones
├─ High: Verbose, creative
└─ Affects: Detail level, creativity
```

---

## Events That Trigger Emotions

### SUCCESS → Increase Confidence/Engagement
| Event | Impact |
|-------|--------|
| User accepts response | +0.08 confidence |
| User explicitly praises | +0.2 confidence |
| Cache hit validates | +0.05 confidence |

### ERRORS → Increase Frustration
| Event | Impact |
|-------|--------|
| User rejects response | -0.15 confidence, +0.2 frustration |
| Same error 3x | +0.3 frustration, -0.1 confidence |
| LLM returns error | -0.1 confidence, +0.1 frustration |

### ENGAGEMENT → Varies
| Event | Impact |
|-------|--------|
| Complex question | +0.1 engagement |
| User idle 10m+ | -0.2 engagement |
| Quick follow-up | +0.08 engagement |

---

## Response Tones (6 Types)

### 1. CONFIDENT (confidence > 0.7, frustration < 0.3)
```
AI: "This definitely works because..."
- Assertive
- Few disclaimers
- Direct answers
```

### 2. CAUTIOUS (confidence < 0.3)
```
AI: "I think this might work, but you should verify..."
- Lots of hedging
- Suggests verification
- Invites correction
```

### 3. DIDACTIC (frustration > 0.6)
```
AI: "Ok, let me break this down step by step.
1. First... (explain simply)
2. Then...
Does that make sense?"
- Patient
- Assume less knowledge
- Check understanding
```

### 4. BAREBONES (engagement < 0.2)
```
AI: "Here: X does Y."
- Brief
- No examples
- Just facts
```

### 5. CREATIVE (confidence > 0.7, engagement > 0.6)
```
AI: "Think of it like... [analogy]
For example... [creative example]
You can also... [bonus ideas]"
- Verbose
- Analogies and humor
- Multiple examples
```

### 6. NEUTRAL (balanced)
```
AI: Normal helpful response
- Good judgment
- Appropriate detail
```

---

## Real Example

### User makes same error 3 times

**Before (no emotions):**
```
AI: "Try using X with Y parameter."
[still confused]

AI: "You need to pass X to the function."
[still confused]

AI: "Set X equal to Y."
```

**After (with emotions):**
```
[Error detected] → frustration = 0.6
System prompt adjusts to DIDACTIC tone

AI: "Let me break this down carefully.

Step 1: Create a function that does X
Step 2: Inside that function, use Y like this:
        function myFunc(input) {
          return something;
        }
Step 3: Call it like this: myFunc(value)

Does that make sense? Any part you want me to explain more?"
```

---

## Integration Points

### In `llm.ts`: Modulate system prompt
```typescript
import { buildEmotionalPromptModifier } from './emotion-responses.js'
import { emotionalStateManager } from './emotions.js'

const emotionalModifier = buildEmotionalPromptModifier()
const systemPrompt = SYSTEM_PROMPT + '\n\n' + emotionalModifier
```

### In `server.ts`: Record events
```typescript
import { emotionalStateManager } from './emotions.js'
import { detectSuccess, processEmotionEvent } from './emotion-triggers.js'

// After getting response
const successEvent = detectSuccess({ 
  wasAccepted: true,
  userMessage: latestUserMessage 
})
if (successEvent) {
  processEmotionEvent(successEvent)
}
```

### Log emotional health
```typescript
import { buildEmotionalHealthSummary } from './emotion-responses.js'

console.log(buildEmotionalHealthSummary())
// 😊 EMOTIONAL STATE
// Mood: happy | Tone: creative
// ├─ Confidence: ████████░░ 78%
// ├─ Frustration: ░░░░░░░░░░ 2%
// └─ Engagement: ██████░░░░ 64%
```

---

## Decay

Emotions naturally decay over time:
- **Frustration** fades (negative emotions don't last)
- **Engagement** resets (gets boring if idle)
- **Confidence** gravitates to 0.5 (center)

Call `emotionalStateManager.decayEmotions(minutes)` periodically.

---

## Moods (Quick Summary)

| Mood | When? | Behavior |
|------|-------|----------|
| 😊 **Happy** | High conf + engaged | Creative, verbose, confident |
| 😤 **Frustrated** | High frustration | Patient teaching mode |
| 😴 **Bored** | Low engagement | Brief barebones responses |
| 🤔 **Uncertain** | Low confidence | Cautious with disclaimers |
| 😐 **Neutral** | Balanced | Normal helpful mode |

---

## Files

```
src/instincts/
├── emotions.ts              # Core emotional state
├── emotion-triggers.ts      # Event → emotion mapping
├── emotion-responses.ts     # Emotion → response tone
└── README.md (this file)
```

---

## Result

Your AI is now **less robotic**. It:
- Learns from user reactions
- Gets frustrated when you repeat mistakes (teaches more patiently)
- Gets excited about complex problems (responds creatively)
- Gets bored with small talk (responds briefly)
- Grows confident over time (responses become more assertive)

It feels **alive**. 🧠❤️
