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
      javascript: "js", typescript: "ts", jsx: "jsx", tsx: "tsx",
      python: "py", java: "java", kotlin: "kt", swift: "swift",
      go: "go", rust: "rs", cpp: "cpp", c: "c", cs: "cs", php: "php",
      ruby: "rb", html: "html", css: "css", scss: "scss", xml: "xml",
      json: "json", yaml: "yml", sql: "sql", graphql: "graphql",
      sh: "sh", bash: "sh", markdown: "md", svg: "svg", csv: "csv",
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

  const isPreviewable = ["html", "htm", "jsx", "tsx", "svg"].includes(artifactLang?.toLowerCase());
  const ext = artifactLang?.toLowerCase() || "text";

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
        boxShadow: isMobile ? "none" : "-2px 0 12px rgba(0,0,0,0.1)",
        overflow: "hidden",
        animation: isMobile ? "slideIn 0.3s ease forwards" : "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "#fafafa",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            {isPreviewable ? "Preview" : "Code"}
          </h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--text3)",
              margin: "4px 0 0",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {ext} • {artifact.split("\n").length} lines
          </p>
        </div>
        <button
          onClick={onClose}
          title="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
            color: "var(--text3)",
            padding: 0,
            lineHeight: 1,
            transition: "color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
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
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          style={{
            fontSize: 12,
            padding: "6px 12px",
            background: "var(--sidebar)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            color: copied ? "var(--orange)" : "var(--text2)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.background = "var(--hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--sidebar)";
          }}
        >
          {copied ? "✓ Copied!" : "📋 Copy"}
        </button>

        <button
          onClick={handleDownload}
          title="Download file"
          style={{
            fontSize: 12,
            padding: "6px 12px",
            background: "var(--sidebar)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            color: "var(--text2)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 5,
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
          padding: 0,
          background: isPreviewable ? "#fff" : "var(--cream)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isPreviewable ? (
          /* Live Preview for HTML/JSX/SVG */
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <iframe
                srcDoc={artifact}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "#fff",
                }}
                title="artifact-preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        ) : (
          /* Code Display with Syntax Highlighting */
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                flex: 1,
                overflow: "auto",
                background: "#fafafa",
              }}
            >
              <SyntaxHighlighter
                language={artifactLang || "text"}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  padding: "16px",
                  fontSize: 13,
                  fontFamily: "var(--mono)",
                  background: "#fafafa",
                  lineHeight: 1.6,
                }}
                wrapLines={true}
                wrapLongLines={true}
              >
                {artifact}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          background: "#fafafa",
          fontSize: 11,
          color: "var(--text3)",
          flexShrink: 0,
        }}
      >
        {isPreviewable ? "Live Preview" : "Code View"} • {ext.toUpperCase()}
      </div>
    </div>
  );
}
