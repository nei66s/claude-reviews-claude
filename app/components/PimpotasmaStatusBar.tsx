"use client";

export function PimpotasmaStatusBar() {
  const memeTexts = [
    "🎪 Pimpotasma: Onde o caos é nosso admin",
    "🎪 Hoje na Pimpotasma Labs: Feito com ❤️ e café",
    "🎪 Status: Tudo em controle (mentira)",
    "🎪 Pimpotasma: Mais fretes, mais histórias",
    "🎪 CEO: Um burro fofo. Dev: Um menininho lindo",
    "🎪 Roadmap Pimpotasma: Fazer, testar, mandar fretes",
    "🎪 Stack: Node, TypeScript, amor e dedicação",
  ];

  const today = new Date().toDateString();
  const messageIndex = today.split(" ").reduce((acc, char) => acc + char.charCodeAt(0), 0) % memeTexts.length;
  const dailyMeme = memeTexts[messageIndex];

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
      borderTop: '1px solid rgba(236, 72, 153, 0.2)',
      borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
      padding: '10px 16px',
      fontSize: '12px',
      color: 'var(--text)',
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: '8px',
    }}>
      {dailyMeme}
    </div>
  );
}

export default PimpotasmaStatusBar;
