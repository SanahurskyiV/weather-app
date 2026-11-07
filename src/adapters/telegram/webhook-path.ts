/**
 * The path Telegram posts updates to. Kept out of `src/worker.ts`: workerd treats every named export of the
 * main module as an entry point and refuses to start on a string (fix 2026-11-07).
 */
export const WEBHOOK_PATH = "/webhook";
