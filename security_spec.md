# Security Specification - Senior Man

## 1. Data Invariants
- Users can only access their own data.
- Session IDs and Message IDs must be valid (alphanumeric, max 128 chars).
- Sessions must have `userId`, `title`, `createdAt`, `updatedAt`.
- Messages must have `id`, `role`, `text`, `timestamp`.
- Maximum text size for messages: 10,000 characters.
- Maximum text size for session titles: 100 characters.

## 2. The Dirty Dozen Payloads (Rejections)
1. **Identity Spoofing**: User A tries to create a session at `/users/UserB/sessions/S1`.
2. **Path Poisoning**: User A tries to create a session with ID `../sneaky`.
3. **Ghost Fields**: User A tries to add `isAdmin: true` to `/users/UserA`.
4. **Denial of Wallet**: User A tries to upload 1MB string as `text`.
5. **Relational Break**: User A creates a message in a session subcollection `/users/UserA/sessions/SessionB/messages/M1` where `SessionB` doesn't exist.
6. **Immutable Update**: User A tries to change `createdAt` on an existing session.
7. **Privilege Escalation**: User A tries to update `userId` on their own session to `UserB`.
8. **PII Leak**: Authenticated User A tries to read `/users/UserB`.
9. **Unauthenticated Write**: Anonymous user tries to create a session.
10. **State Shortcut**: User tries to update `updatedAt` to a future time.
11. **Type Poisoning**: User tries to send `timestamp` as a string instead of a number.
12. **Recursive Access**: User A tries to list ALL sessions in the database.

## 3. Test Runner
(Implemented in rules logic and verified via mental red-team audit)
