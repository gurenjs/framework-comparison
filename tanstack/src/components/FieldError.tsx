export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="field-error">{messages.join(' ')}</p>
}
