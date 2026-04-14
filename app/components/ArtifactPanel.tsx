"use client";

import { useState, useMemo } from "react";
import { Copy, Expand, Minimize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import type { Artifact } from "../lib/artifactDetection";
import { copyCodeToClipboard } from "../lib/codeActions";
import { showToast } from "../hooks/useToast";

type ArtifactPanelProps = {
  artifact: Artifact | Artifact[] | null;
  onClose: () => void;
};

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === "markdown") {
    return (
      <div className="artifact-markdown">
        <ReactMarkdown>{artifact.content}</ReactMarkdown>
      </div>
    );
  }

  if (artifact.kind === "html") {
    return (
      <div className="artifact-html-preview">
        <iframe title={artifact.title} sandbox="" srcDoc={artifact.content} />
        <div className="artifact-source">
          <SyntaxHighlighter language="html" style={vscDarkPlus} customStyle={{ margin: 0, background: "transparent" }}>
            {artifact.content}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  return (
    <SyntaxHighlighter
      language={artifact.language || (artifact.kind === "json" ? "json" : "text")}
      style={vscDarkPlus}
      customStyle={{ margin: 0, background: "transparent", minHeight: "100%" }}
    >
      {artifact.content}
    </SyntaxHighlighter>
  );
}

export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Normalize to array
  const artifacts = useMemo(() => {
    if (!artifact) return [];
    if (Array.isArray(artifact)) return artifact;
    return [artifact];
  }, [artifact]);

  if (!artifacts.length) return null;

  const current = artifacts[currentIndex];
  const hasMultiple = artifacts.length > 1;

  const handleCopy = async () => {
    try {
      await copyCodeToClipboard(current.content);
      showToast({
        tone: "success",
        title: "Artifact copiado",
        description: current.title,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Falha ao copiar artifact",
        description: error instanceof Error ? error.message : "Não foi possível copiar o conteúdo.",
      });
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : artifacts.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < artifacts.length - 1 ? prev + 1 : 0));
  };

  return (
    <aside className={`artifact-panel ${fullscreen ? "fullscreen" : ""}`}>
      <div className="artifact-panel-header">
        <div>
          <div className="artifact-panel-eyebrow">{current.kind}</div>
          <div className="artifact-panel-title">{current.title}</div>
          {hasMultiple && (
            <div className="artifact-panel-counter">
              {currentIndex + 1} de {artifacts.length}
            </div>
          )}
        </div>
        <div className="artifact-panel-actions">
          {hasMultiple && (
            <>
              <button
                type="button"
                className="artifact-panel-action"
                onClick={handlePrev}
                aria-label="Artifact anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="artifact-panel-action"
                onClick={handleNext}
                aria-label="Próximo artifact"
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}
          <button type="button" className="artifact-panel-action" onClick={handleCopy} aria-label="Copiar artifact">
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="artifact-panel-action"
            onClick={() => setFullscreen((current) => !current)}
            aria-label={fullscreen ? "Sair do modo expandido" : "Expandir artifact"}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}
          </button>
          <button type="button" className="artifact-panel-action close" onClick={onClose} aria-label="Fechar painel">
            <X size={15} />
          </button>
        </div>
      </div>

      {current.preview ? <div className="artifact-panel-preview">{current.preview}</div> : null}

      <div className="artifact-panel-body">
        <ArtifactContent artifact={current} />
      </div>
    </aside>
  );
}
