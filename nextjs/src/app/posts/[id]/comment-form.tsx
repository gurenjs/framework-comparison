"use client";

import { useActionState } from "react";
import { createComment } from "@/lib/actions/comments";

export function CommentForm({ postId }: { postId: number }) {
  const [state, formAction, pending] = useActionState(
    createComment.bind(null, postId),
    {},
  );

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="comment-body">Add a comment</label>
        <textarea
          id="comment-body"
          name="body"
          defaultValue={state.values?.body}
        />
        {state.errors?.body && <p className="error">{state.errors.body[0]}</p>}
      </div>
      <button type="submit" disabled={pending}>
        Comment
      </button>
    </form>
  );
}
