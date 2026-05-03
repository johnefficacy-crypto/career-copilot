"use client"

import { useRef } from "react"
import { createCommentAction } from "@/actions/forum"

interface Props {
  postId:   string
  parentId: string | null
}

export function CommentForm({ postId, parentId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  async function handleAction(formData: FormData) {
    await createCommentAction(formData)
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={handleAction}>
      <input type="hidden" name="post_id"   value={postId}          />
      <input type="hidden" name="parent_id" value={parentId ?? ""}  />

      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <textarea
          name="body"
          rows={3}
          placeholder={parentId ? "Write a reply…" : "Write a comment…"}
          required
          minLength={5}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:opacity-40"
          style={{ color: "rgba(255,255,255,0.80)" }}
        />
        <div className="flex justify-end mt-3">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl text-sm transition-colors"
            style={{ background: "var(--gold)", color: "#0c0c0c" }}
          >
            {parentId ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
    </form>
  )
}
