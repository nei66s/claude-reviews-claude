/**
 * Emotions Demo — See emotional state in action
 *
 * Run with: npm run test
 * or access via: GET /api/emotions/health (in server)
 */
import { emotionalStateManager } from './emotions.js';
import { buildEmotionalHealthSummary } from './emotion-responses.js';
import { detectSuccess, detectError, detectEngagement, processEmotionEvent, } from './emotion-triggers.js';
async function demoEmotionalJourney() {
    console.log('\n🎭 EMOTIONAL JOURNEY DEMO\n');
    // Start neutral
    console.log('📍 Initial State:');
    console.log(buildEmotionalHealthSummary());
    // Scenario 1: User asks complex question (engagement spike)
    console.log('\n📍 User asks complex question...');
    const complexEvent = detectEngagement({
        userMessage: 'Can you explain the difference between X and Y and how they relate to Z?',
        messageLength: 85,
    });
    if (complexEvent) {
        processEmotionEvent(complexEvent);
    }
    console.log(buildEmotionalHealthSummary());
    // Scenario 2: User accepts response (confidence)
    console.log('\n📍 User accepts & says "thanks, that helped!"...');
    const successEvent = detectSuccess({
        userMessage: 'thanks, that helped!',
        wasAccepted: true,
        wasPraised: false,
    });
    if (successEvent) {
        processEmotionEvent(successEvent);
    }
    console.log(buildEmotionalHealthSummary());
    // Scenario 3: Same error repeated (frustration)
    console.log('\n📍 User makes same error for the 3rd time...');
    const errorEvent = detectError({
        userMessage: 'Still getting the same error',
        sameErrorCount: 3,
    });
    if (errorEvent) {
        processEmotionEvent(errorEvent);
    }
    console.log(buildEmotionalHealthSummary());
    console.log('💭 System now in DIDACTIC mode (patient teaching)');
    // Scenario 4: Idle (engagement decay)
    console.log('\n📍 User idle for 15 minutes...');
    emotionalStateManager.decayEmotions(15);
    console.log(buildEmotionalHealthSummary());
    // Scenario 5: Praise (major confidence boost)
    console.log('\n📍 User: "Wow, that was perfect! Exactly what I needed!"');
    const praiseEvent = detectSuccess({
        userMessage: "Wow, that was perfect! Exactly what I needed!",
        wasPraised: true,
    });
    if (praiseEvent) {
        processEmotionEvent(praiseEvent);
    }
    console.log(buildEmotionalHealthSummary());
    console.log('💭 System now in CREATIVE mode (inspired & confident)');
    // Show emotional profile
    console.log('\n📊 Final Emotional Profile:');
    console.log(emotionalStateManager.export());
    // Show history
    console.log('\n📜 Recent emotional history:');
    const history = emotionalStateManager.getHistory(5);
    history.forEach((entry, i) => {
        console.log(`  ${i + 1}. [${entry.event}] → Mood: ${entry.vector.confidence > 0.7 && entry.vector.engagement > 0.6 ? '😊' : entry.vector.frustration > 0.6 ? '😤' : '😐'}`);
    });
}
async function demoResponseTones() {
    console.log('\n🎤 RESPONSE TONES BY MOOD\n');
    const baseResponse = 'To fix this issue, you need to configure the settings properly and ensure all dependencies are installed.';
    // Confident tone
    emotionalStateManager.import({ confidence: 0.85, frustration: 0.1, engagement: 0.7 });
    console.log('😊 CONFIDENT:\n', baseResponse);
    // Cautious tone
    emotionalStateManager.import({ confidence: 0.2, frustration: 0.1, engagement: 0.5 });
    console.log('\n🤔 CAUTIOUS:\n', 'I think you might need to configure the settings properly...');
    // Didactic (patient) tone
    emotionalStateManager.import({ confidence: 0.7, frustration: 0.8, engagement: 0.6 });
    console.log('\n😤 DIDACTIC (Teaching Mode):\nLet me break this down for you:\n1. First, configure...\n2. Then ensure...\nDoes that make sense?');
    // Barebones (bored) tone
    emotionalStateManager.import({ confidence: 0.5, frustration: 0.2, engagement: 0.1 });
    console.log('\n😴 BAREBONES:\nConfigure settings. Install dependencies.');
    // Creative (inspired) tone
    emotionalStateManager.import({ confidence: 0.9, frustration: 0.0, engagement: 0.95 });
    console.log('\n💡 CREATIVE:\nThink of your configuration like...\nFor example, you might...\nYou could also explore...');
}
async function demoEmotionDecay() {
    console.log('\n⏰ EMOTION DECAY OVER TIME\n');
    // spike frustration
    emotionalStateManager.import({ confidence: 0.5, frustration: 1.0, engagement: 0.3 });
    console.log('Time 0min:\n', buildEmotionalHealthSummary());
    emotionalStateManager.decayEmotions(5);
    console.log('\nTime 5min:\n', buildEmotionalHealthSummary());
    emotionalStateManager.decayEmotions(10);
    console.log('\nTime 15min:\n', buildEmotionalHealthSummary());
    emotionalStateManager.decayEmotions(30);
    console.log('\nTime 45min:\n', buildEmotionalHealthSummary());
    console.log('💨 See how frustration fades and engagement returns to baseline');
}
async function runAllDemos() {
    console.log('='.repeat(70));
    console.log('🎭 EMOTION SYSTEM DEMOS');
    console.log('='.repeat(70));
    await demoEmotionalJourney();
    await demoResponseTones();
    await demoEmotionDecay();
    console.log('\n' + '='.repeat(70));
    console.log('✅ Emotion system demo complete!');
    console.log('='.repeat(70) + '\n');
}
if (import.meta.main) {
    runAllDemos().catch(console.error);
}
export { demoEmotionalJourney, demoResponseTones, demoEmotionDecay };
