/**
 * components/forum/PostBody.tsx
 *
 * Safe body renderer — no external markdown parser (no extra dep).
 * Handles newlines, paragraphs, inline code, and bold.
 * Same lightweight approach as MessageBubble in the chat feature.
 */

interface Props {
  body: string
}

export function PostBody({ body }: Props) {
  const paragraphs = body.split(/\n\n+/)

  return (
    <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n")
        const isList = lines.every(
          (l) => l.match(/^\s*[-•*>]\s/) || l.trim() === ""
        )

        if (isList) {
          return (
            <ul key={pi} className="my-2" style={{ paddingLeft: "1.25rem" }}>
              {lines
                .filter((l) => l.trim())
                .map((line, li) => (
                  <li key={li} className="flex items-start gap-2 mb-1">
                    <span style={{ color: "var(--gold)", marginTop: "2px", flexShrink: 0 }}>•</span>
                    <span>{formatInline(line.replace(/^\s*[-•*>]\s/, ""))}</span>
                  </li>
                ))}
            </ul>
          )
        }

        return (
          <p key={pi} className="my-2">
            {lines.map((line, li) => (
              <span key={li}>
                {formatInline(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function formatInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "rgba(255,255,255,0.90)", fontWeight: 500 }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded text-xs"
          style={{
            background: "rgba(255,255,255,0.07)",
            fontFamily: "var(--font-mono)",
            color: "var(--gold)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}