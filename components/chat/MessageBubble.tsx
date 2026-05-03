"use client"

/**
 * components/chat/MessageBubble.tsx
 *
 * Renders a single chat message with rich formatting.
 * No external markdown parser — hand-rolled for performance and bundle size.
 *
 * Supports:
 *  - ### / ## / # headings
 *  - **bold** and *italic* inline
 *  - `inline code` and ```code blocks```
 *  - - / • / * bullet lists and 1. numbered lists
 *  - > blockquotes
 *  - Double newline paragraph breaks
 *  - Streaming cursor animation
 */

import { memo } from "react"
import type { ChatMessage } from "@/types/chat"

interface Props {
  message:   ChatMessage
  streaming?: boolean
}

export const MessageBubble = memo(function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === "user"

  return (
    <div
      style={{
        display:       "flex",
        alignItems:    "flex-start",
        gap:           "0.625rem",
        flexDirection: isUser ? "row-reverse" : "row",
        maxWidth:      "100%",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width:          "1.875rem",
          height:         "1.875rem",
          borderRadius:   "50%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "0.6rem",
          fontWeight:     600,
          flexShrink:     0,
          letterSpacing:  "0.05em",
          ...(isUser
            ? {
                background: "rgba(255,255,255,0.07)",
                border:     "1px solid rgba(255,255,255,0.13)",
                color:      "rgba(255,255,255,0.45)",
              }
            : {
                background: "linear-gradient(135deg, rgba(232,213,163,0.18) 0%, rgba(232,213,163,0.08) 100%)",
                border:     "1px solid rgba(232,213,163,0.35)",
                color:      "var(--gold, #e8d5a3)",
              }),
        }}
      >
        {isUser ? "YOU" : "AI"}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth:    "min(78%, 42rem)",
          padding:     isUser ? "0.625rem 0.875rem" : "0.75rem 1rem",
          borderRadius: isUser ? "1rem 0.25rem 1rem 1rem" : "0.25rem 1rem 1rem 1rem",
          fontSize:    "0.875rem",
          lineHeight:  1.65,
          ...(isUser
            ? {
                background: "rgba(232,213,163,0.09)",
                border:     "1px solid rgba(232,213,163,0.2)",
                color:      "rgba(255,255,255,0.88)",
              }
            : {
                background: "var(--bg-surface, #111)",
                border:     "1px solid rgba(255,255,255,0.07)",
                color:      "rgba(255,255,255,0.82)",
              }),
        }}
      >
        {!isUser && (
          <div
            style={{
              marginBottom: "0.5rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.68rem",
              letterSpacing: "0.02em",
              color: "rgba(232,213,163,0.88)",
              background: "rgba(232,213,163,0.08)",
              border: "1px solid rgba(232,213,163,0.22)",
              borderRadius: "999px",
              padding: "0.18rem 0.5rem",
            }}
            aria-label="AI guidance confidence"
            title="AI guidance only. Verify official notifications and deterministic eligibility outputs."
          >
            <span>AI guidance</span>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>·</span>
            <span>Confidence: medium</span>
          </div>
        )}
        <FormattedContent text={message.content} isUser={isUser} />
        {streaming && <BlinkCursor />}
      </div>

      <style>{`
        @keyframes cc-cursor  { 0%,100%{opacity:.9} 50%{opacity:0} }
        @keyframes cc-fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  )
})

// ─── Cursor ───────────────────────────────────────────────────────────────────

function BlinkCursor() {
  return (
    <span
      style={{
        display:       "inline-block",
        width:         "2px",
        height:        "0.9em",
        marginLeft:    "2px",
        verticalAlign: "middle",
        background:    "var(--gold, #e8d5a3)",
        borderRadius:  "1px",
        animation:     "cc-cursor 1s step-end infinite",
      }}
    />
  )
}

// ─── Content formatter ────────────────────────────────────────────────────────

function FormattedContent({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    // User messages: just paragraph breaks, no heavy formatting
    return (
      <>
        {text.split(/\n\n+/).map((block, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "0.5rem 0 0" }}>
            {block.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </>
    )
  }

  // Assistant: full rich formatting
  const blocks = splitBlocks(text)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  )
}

// ─── Block splitter ───────────────────────────────────────────────────────────

type Block =
  | { type: "heading";   level: 1|2|3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "bullets";   items: string[] }
  | { type: "numbered";  items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "codeblock"; lang: string; code: string }

function splitBlocks(raw: string): Block[] {
  const result: Block[] = []

  // Extract code fences first
  const segments = raw.split(/(```[\s\S]*?```)/g)

  for (const seg of segments) {
    if (seg.startsWith("```")) {
      const lines = seg.slice(3).split("\n")
      const lang  = lines[0].trim()
      const code  = lines.slice(1).join("\n").replace(/```$/, "").trimEnd()
      result.push({ type: "codeblock", lang, code })
      continue
    }

    const paragraphs = seg.split(/\n\n+/)

    for (const para of paragraphs) {
      if (!para.trim()) continue
      const lines = para.split("\n").filter((l) => l.trim())
      if (!lines.length) continue

      // Heading
      const headingMatch = lines[0].match(/^(#{1,3})\s+(.+)$/)
      if (lines.length === 1 && headingMatch) {
        result.push({
          type:  "heading",
          level: headingMatch[1].length as 1|2|3,
          text:  headingMatch[2],
        })
        continue
      }

      // Blockquote
      if (lines.every((l) => l.startsWith(">"))) {
        result.push({
          type: "blockquote",
          text: lines.map((l) => l.replace(/^>\s*/, "")).join(" "),
        })
        continue
      }

      // Bullet list
      if (lines.some((l) => /^\s*[-•*]\s/.test(l))) {
        result.push({
          type:  "bullets",
          items: lines.map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean),
        })
        continue
      }

      // Numbered list
      if (lines.some((l) => /^\s*\d+[.)]\s/.test(l))) {
        result.push({
          type:  "numbered",
          items: lines.map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean),
        })
        continue
      }

      // Paragraph
      result.push({ type: "paragraph", lines })
    }
  }

  return result
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {

    case "heading": {
      const sizes = { 1: "1.05rem", 2: "0.9875rem", 3: "0.9rem" }
      return (
        <p
          key={key}
          style={{
            fontSize:     sizes[block.level],
            fontWeight:   600,
            color:        "rgba(255,255,255,0.96)",
            margin:       0,
            paddingTop:   block.level === 1 ? "0.25rem" : 0,
            borderBottom: block.level === 1 ? "1px solid rgba(232,213,163,0.15)" : undefined,
            paddingBottom: block.level === 1 ? "0.25rem" : undefined,
          }}
        >
          {inlineFormat(block.text)}
        </p>
      )
    }

    case "paragraph":
      return (
        <p key={key} style={{ margin: 0, lineHeight: 1.65 }}>
          {block.lines.map((line, j, arr) => (
            <span key={j}>
              {inlineFormat(line)}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      )

    case "bullets":
      return (
        <ul key={key} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ color: "var(--gold, #e8d5a3)", flexShrink: 0, fontSize: "0.7rem", marginTop: "0.35em" }}>◆</span>
              <span style={{ lineHeight: 1.6 }}>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )

    case "numbered":
      return (
        <ol key={key} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span
                style={{
                  color:      "var(--gold, #e8d5a3)",
                  flexShrink: 0,
                  fontSize:   "0.75rem",
                  fontWeight: 600,
                  minWidth:   "1.2rem",
                  marginTop:  "0.15em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {j + 1}.
              </span>
              <span style={{ lineHeight: 1.6 }}>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      )

    case "blockquote":
      return (
        <p
          key={key}
          style={{
            margin:     0,
            paddingLeft: "0.75rem",
            borderLeft:  "2px solid rgba(232,213,163,0.4)",
            color:       "rgba(255,255,255,0.55)",
            fontStyle:   "italic",
            fontSize:    "0.85rem",
          }}
        >
          {inlineFormat(block.text)}
        </p>
      )

    case "codeblock":
      return (
        <div key={key} style={{ borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          {block.lang && (
            <div
              style={{
                padding:    "0.25rem 0.75rem",
                background: "rgba(255,255,255,0.05)",
                fontSize:   "0.7rem",
                color:      "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-mono, monospace)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {block.lang}
            </div>
          )}
          <pre
            style={{
              margin:     0,
              padding:    "0.75rem",
              background: "rgba(0,0,0,0.35)",
              fontSize:   "0.8rem",
              lineHeight: 1.55,
              color:      "rgba(255,255,255,0.75)",
              fontFamily: "var(--font-mono, 'Fira Code', monospace)",
              overflowX:  "auto",
              whiteSpace: "pre-wrap",
              wordBreak:  "break-word",
            }}
          >
            {block.code}
          </pre>
        </div>
      )

    default:
      return null
  }
}

// ─── Inline formatter: **bold**, *italic*, `code` ────────────────────────────

function inlineFormat(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} style={{ color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      )
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            padding:      "0.1em 0.35em",
            borderRadius: "0.25rem",
            fontSize:     "0.82em",
            background:   "rgba(232,213,163,0.1)",
            border:       "1px solid rgba(232,213,163,0.2)",
            fontFamily:   "var(--font-mono, monospace)",
            color:        "var(--gold, #e8d5a3)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}