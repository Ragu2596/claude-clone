import { useState } from "react";

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
      toml: "toml",
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

    const ext = FILE_EXT_MAP[artifactLang] || "txt";
    const blob = new Blob([artifact], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artifact-${Date.now()}.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const isPreviewable = ["html", "htm", "jsx", "svg"].includes(artifactLang);
  const ext = artifactLang || "text";

  return (
    <div
      style={{
        position: isMobile ? "fixed" : "relative",
        right: 0,
        top: 0,
        bottom: 0,
        width: isMobile ? "100%" : "40%",
        background: "#fff",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: isMobile ? 200 : 100,
        boxShadow: isMobile ? "none" : "-2px 0 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {isPreviewable ? "Preview" : "Code"}
          </h3>
          <p
            style={{
              fontSize: 11,
              color: "var(--text3)",
              margin: "3px 0 0",
            }}
          >
            {ext}
          </p>
        </div>
        <button
          onClick={onClose}
          title="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: "var(--text3)",
            padding: 4,
            lineHeight: 1,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
        >
          ✕
        </button>
      </div>

      {/* Toolbar */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          flexShrink: 0,
          background: "#fafaf8",
        }}
      >
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          style={{
            fontSize: 11,
            padding: "5px 10px",
            background: "var(--sidebar)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            color: copied ? "var(--orange)" : "var(--text2)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--sidebar)")}
        >
          {copied ? "✓ Copied!" : "📋 Copy"}
        </button>
        <button
          onClick={handleDownload}
          title="Download file"
          style={{
            fontSize: 11,
            padding: "5px 10px",
            background: "var(--sidebar)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            color: "var(--text2)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--sidebar)")}
        >
          📥 Download
        </button>
      </div>

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          background: "var(--cream)",
          position: "relative",
        }}
      >
        {isPreviewable ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#fff",
              borderRadius: 10,
              border: "1px solid var(--border)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <iframe
              srcDoc={artifact}
              style={{
                flex: 1,
                border: "none",
                background: "#fff",
              }}
              title="artifact-preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: 12,
                overflowY: "auto",
                fontSize: 12,
                fontFamily: "var(--mono)",
                lineHeight: 1.5,
                color: "var(--text)",
                flex: 1,
                background: "#fff",
              }}
            >
              <code>{artifact}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
