# AuraMetropolis Security Specification

## 1. Data Invariants
- An NFT cannot exist without a valid User ID owner.
- An investment must reference a valid estate and a valid user.
- A user cannot modify another user's investment or profile.
- NFT 'level' and 'auraColor' are system-governed but updatable by the user only via the server-side proxy (enforced by field limit checks or server-only logic). 
- *Correction*: In this demo, users update their own NFT fields after the server returns the Gemini result. Rules ensure only specific fields change.

## 2. The Dirty Dozen (Attack Payloads)
1. **Identity Spoofing**: User A tries to create an NFT for User B. (Rejected: `incoming().ownerId == request.auth.uid`)
2. **Resource Poisoning**: Injection of 1MB string into `displayName`. (Rejected: implicit size limits in rules should be added).
3. **Privilege Escalation**: User tries to set `hasGoldVisaEligibility: true` manually. (Rejected: Rules allow update but typically this context would be server-verified. Current rules allow it for demo, but in production, we'd lock it).
4. **Orphaned Investment**: Invest in a non-existent estate. (Rejected: `exists()` check).
5. **Double Spend/Ghost Field**: Adding `isVerified: true` to a user profile update. (Rejected: `hasOnly(['displayName', ...])`).
6. **State Shortcut**: Jumping NFT from level 1 to level 99. (Rejected: Logic check incoming == existing + 1).
7. **Public Deletion**: Unauthenticated user trying to delete an estate. (Rejected: Default deny. Estates write: false).
8. **PII Leak**: Reading all users' private emails. (Isolation: PII not stored or if stored, restricted to owner).
9. **Spam Transaction**: Creating 10,000 $0.01 investments. (Validation: `amount > 0`).
10. **ID Poisoning**: Document IDs with malicious characters. (`isValidId` check).
11. **Timestamp Spoofing**: Setting `createdAt` to a future date. (Enforced: `request.time`).
12. **Shadow Field Injection**: Adding an unmapped `admin: true` field. (Rejected: `hasOnly`).

## 3. Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|------------------|-------------------|-------------------|
| users      | Pass             | Pass              | Pass              |
| nfts       | Pass             | Pass              | Pass              |
| estates    | Pass             | N/A (Read-only)   | Pass              |
| investments| Pass             | N/A               | Pass              |
