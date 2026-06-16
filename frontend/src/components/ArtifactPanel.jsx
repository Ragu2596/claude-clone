import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ArtifactPanel({ artifact, artifactLang, onClose, isMobile = false }) {
  if (!artifact) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const FILE_EXT_MAP = {
      javascript: "js",
      typescript: "ts",
      jsx: "jsx",
      tsx: "tsx",
      python: "py",
      java: "java",
      kotlin: "kt",
      swift: "swift",
      go: "go",
      rust: "rs",
      cpp: "cpp",
      c: "c",
      cs: "cs",
      php: "php",
      ruby: "rb",
      html: "html",
      css: "css",
      scss: "scss",
      xml: "xml",
      json: "json",
      yaml: "yml",
      yml: "yml",
      sql: "sql",
      graphql: "graphql",
      sh: "sh",
      bash: "sh",
      markdown: "md",
      md: "md",
      svg: "svg",
      csv: "csv",
      dockerfile: "dockerfile",
    };

    const ext = FILE_EXT_MAP[artifactLang?.toLowerCase()] || "txt";
    const blob = new Blob([artifact], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artifact-${Date.now()}.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const isPreviewable = ["html", "htm", "jsx", "tsx", "svg"].includes(
    artifactLang?.toLowerCase()
  );
  const ext = artifactLang?.toLowerCase() || "text";
  const lineCount = artifact.split("\n").length;

  return (
    <div
      style={{
        position: isMobile ? "fixed" : "relative",
        right: 0,
        top: 0,
        bottom: 0,
        width: isMobile ? "100%" : "40%",
        height: "100vh",
        background: "#fff",
        borderLeft: `1px solid #e5e5e5`,
        display: "flex",
        flexDirection: "column",
        zIndex: isMobile ? 200 : 100,
        boxShadow: "-1px 0 3px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Header - Claude Style */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "#d4d4d8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            {"<>"}
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "#000",
                letterSpacing: "0",
              }}
            >
              {isPreviewable ? "Preview" : "Code"}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: "#9ca3af",
            padding: "4px 8px",
            lineHeight: 1,
            transition: "color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#4b5563")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
        >
          ×
        </button>
      </div>

      {/* Toolbar - Claude Style */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          gap: 6,
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <button
          onClick={handleCopy}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            background: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            color: copied ? "#059669" : "#374151",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.background = "#e5e7eb";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f3f4f6";
          }}
        >
          {copied ? "✓" : "📋"} {copied ? "Copied" : "Copy"}
        </button>

        <button
          onClick={handleDownload}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            background: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            color: "#374151",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e5e7eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f3f4f6";
          }}
        >
          📥 Download
        </button>
      </div>

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: isPreviewable ? "#fff" : "#f9fafb",
        }}
      >
        {isPreviewable ? (
          /* Live Preview - Claude Style */
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <iframe
              srcDoc={artifact}
              style={{
                flex: 1,
                border: "none",
                background: "#fff",
                width: "100%",
                height: "100%",
              }}
              title="artifact-preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : (
          /* Code Display - Claude Style */
          <div
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SyntaxHighlighter
              language={ext === "text" ? "text" : ext}
              style={oneLight}
              customStyle={{
                margin: 0,
                padding: "16px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                background: "#f9fafb",
                lineHeight: 1.5,
                height: "100%",
              }}
              wrapLines={true}
              wrapLongLines={true}
              showLineNumbers={lineCount > 10}
            >
              {artifact}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}
