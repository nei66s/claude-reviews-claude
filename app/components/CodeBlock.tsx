"use client";

import { useState } from "react";
import { Copy, FilePlus2, Play, PanelsTopLeft } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import type { Artifact } from "../lib/artifactDetection";
import { copyCodeToClipboard, createFileFromCode, executeCodeSnippet, type CodeExecutionResult } from "../lib/codeActions";
import { showToast } from "../hooks/useToast";
import CodeOutput from "./CodeOutput";

const languageToExtension: Record<string, string> = {
  javascript: ".js",
  typescript: ".ts",
  python: ".py",
  bash: ".sh",
  powershell: ".ps1",
  json: ".json",
  html: ".html",
  css: ".css",
  markdown: ".md",
};

type CodeBlockProps = {
  code: string;
  language?: string;
  title?: string;
  onOpenArtifact?: (artifact: Artifact) => void;
};

export default function CodeBlock({ code, language, title, onOpenArtifact }: CodeBlockProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CodeExecutionResult | null>(null);

  const normalizedLanguage = (language || "").trim().toLowerCase() || "text";

  const handleCopy = async () => {
    try {
      await copyCodeToClipboard(code);
      showToast({
        tone: "success",
        title: "Código copiado",
        description: "O bloco foi enviado para o clipboard.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Falha ao copiar",
        description: error instanceof Error ? error.message : "Não foi possível copiar o código.",
      });
    }
  };

  const handleCreateFile = async () => {
    const suggestedName = `snippet${languageToExtension[normalizedLanguage] || ".txt"}`;
    const targetPath = window.prompt("Salvar código em qual caminho?", suggestedName);
    if (!targetPath) return;

    try {
      await createFileFromCode(targetPath, code);
      showToast({
        tone: "success",
        title: "Arquivo criado",
        description: targetPath,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Falha ao criar arquivo",
        description: error instanceof Error ? error.message : "Não foi possível salvar o arquivo.",
      });
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const execution = await executeCodeSnippet(language, code);
      setResult(execution);
      showToast({
        tone: execution.ok ? "success" : "error",
        title: execution.ok ? "Execução concluída" : "Execução com erro",
        description: `${execution.language} • exit ${execution.exitCode ?? "?"}`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Falha ao executar",
        description: error instanceof Error ? error.message : "Não foi possível executar o código.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const openArtifact = () => {
    onOpenArtifact?.({
      id: `code-artifact-${title || normalizedLanguage}`,
      kind: normalizedLanguage === "json" ? "json" : normalizedLanguage === "html" ? "html" : "code",
      title: title || `${normalizedLanguage.toUpperCase()} Block`,
      content: code,
      language: normalizedLanguage,
      source: "message",
    });
  };

  return (
    <div className="code-block-shell">
      <div className="code-block-toolbar">
        <div className="code-block-language">{title || normalizedLanguage}</div>
        <div className="code-block-actions">
          <button type="button" className="code-block-action" onClick={handleCopy} aria-label="Copiar código">
            <Copy size={14} />
            <span>Copy</span>
          </button>
          <button type="button" className="code-block-action" onClick={handleCreateFile} aria-label="Criar arquivo">
            <FilePlus2 size={14} />
            <span>Create File</span>
          </button>
          <button
            type="button"
            className="code-block-action"
            onClick={handleRun}
            aria-label="Executar código"
            disabled={isRunning}
          >
            <Play size={14} />
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
          {onOpenArtifact ? (
            <button type="button" className="code-block-action" onClick={openArtifact} aria-label="Abrir no painel">
              <PanelsTopLeft size={14} />
              <span>Panel</span>
            </button>
          ) : null}
        </div>
      </div>

      <SyntaxHighlighter language={normalizedLanguage} style={vscDarkPlus} customStyle={{ margin: 0, background: "transparent" }}>
        {code}
      </SyntaxHighlighter>

      {result ? <CodeOutput result={result} /> : null}
    </div>
  );
}
