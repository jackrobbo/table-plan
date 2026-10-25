/** Private beta switch. When on, creating a NEW account needs an invite code (existing accounts sign in as normal). */
export const inviteOnly = process.env.NEXT_PUBLIC_INVITE_ONLY === '1';
/** Comma-separated codes accepted by the MOCK backend only, so the gate can be previewed. Real codes live in the database. */
export const devInviteCodes = (process.env.NEXT_PUBLIC_DEV_INVITE_CODES ?? 'TABLE-DEMO').split(',').map((c) => c.trim()).filter(Boolean);
/** Free beta: everyone gets full access and plans/paywall are hidden. Unset it at launch and billing applies as normal. */
export const freeBeta = process.env.NEXT_PUBLIC_FREE_BETA === '1';
