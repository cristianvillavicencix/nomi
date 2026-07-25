/** True when a mail shortcut should not fire (typing, compose, dialogs). */
export function shouldIgnoreMailKeyboardShortcut(
  event: KeyboardEvent,
  options?: { composeOpen?: boolean },
): boolean {
  if (options?.composeOpen) return true;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.closest('[role="dialog"]')) return true;

  return false;
}

export function isMailTrashShortcutKey(key: string): boolean {
  return key === "#" || key === "Delete";
}
