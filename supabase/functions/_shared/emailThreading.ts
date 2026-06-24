export const formatMessageId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("<") ? trimmed : `<${trimmed}>`;
};

export const buildEmailThreadHeaders = (params: {
  messageId: string;
  inReplyTo?: string | null;
  priorMessageIds?: Array<string | null | undefined>;
}) => {
  const messageId = formatMessageId(params.messageId);
  const inReplyTo = params.inReplyTo?.trim()
    ? formatMessageId(params.inReplyTo)
    : null;

  const referenceIds = [
    ...(params.priorMessageIds ?? [])
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id))
      .map(formatMessageId),
  ];

  if (inReplyTo && !referenceIds.includes(inReplyTo)) {
    referenceIds.push(inReplyTo);
  }

  const headers: Record<string, string> = {
    "Message-ID": messageId,
  };

  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
  }

  if (referenceIds.length) {
    headers.References = referenceIds.join(" ");
  }

  return headers;
};
