"use client";

import type { CodeExecutionResult } from "../lib/codeActions";

export default function CodeOutput({ result }: { result: CodeExecutionResult }) {
  return (
    <div className="code-output-shell">
      <div className="code-output-meta">
        <span>{result.command}</span>
        <span>{result.durationMs} ms</span>
        <span>exit {result.exitCode ?? "?"}</span>
      </div>

      {result.stdout ? (
        <div className="code-output-stream">
          <div className="code-output-label">stdout</div>
          <pre>{result.stdout}</pre>
        </div>
      ) : null}

      {result.stderr ? (
        <div className="code-output-stream error">
          <div className="code-output-label">stderr</div>
          <pre>{result.stderr}</pre>
        </div>
      ) : null}

      {!result.stdout && !result.stderr ? (
        <div className="code-output-empty">Execução concluída sem saída.</div>
      ) : null}
    </div>
  );
}
