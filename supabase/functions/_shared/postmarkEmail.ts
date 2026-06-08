/** @deprecated Use transactionalEmail.ts — kept for existing imports. */
export {
  type EmailAttachment as PostmarkAttachment,
  getTransactionalEmailProvider,
  getTransactionalFromEmail,
  isTransactionalEmailConfigured,
  isTransactionalEmailConfigured as isPostmarkEmailConfigured,
  isTransactionalEmailSkipped,
  isTransactionalEmailSkipped as isPostmarkEmailSkipped,
  sendTransactionalEmail,
  sendTransactionalEmail as sendPostmarkEmail,
} from "./transactionalEmail.ts";
