# Kairos Grill — Security Specification

## 1. Data Invariants
1. **End-to-End Encrypted Customer PII**: Customer names, phone numbers, delivery addresses, GPS coordinates, and notes in `/orders` and `/complaints` are encrypted in the browser with the restaurant's RSA-OAEP-256 + AES-256-GCM public key stored in `/kitchenVault/rostock`. Even if an unauthenticated client queries `/orders`, customer PII cannot be read without the restaurant owner's Secret PIN.
2. **Non-Readable Private Key & Write Secret**: The restaurant's RSA Private Key and `adminWriteSecret` are stored inside `/kitchenVault/rostock` wrapped with AES-256-GCM derived from the owner's Secret PIN via PBKDF2 (100,000 iterations). Neither the PIN nor the unencrypted secret is stored in source code or Firestore.
3. **Write-Only Admin Proof Verification**: `/adminProofs/{proofId}` is strictly write-only (`allow read: if false`). Updating `/orders`, `/orderTracking`, `/complaints`, or `/kitchenVault/rostock` requires an atomic batch write creating an `adminProofs` document whose `hashing.sha256(adminSecret).toBase64()` matches `/kitchenVault/rostock.adminSecretHash`.
4. **Non-PII Customer Order Tracking**: Customers track live order status via `/orderTracking/{orderId}` with a high-entropy random ID (`size() >= 20`). Collection `list` on `/orderTracking` is forbidden (`allow list: if false`).
5. **Atomic Order Dispatch**: Creating `/orders/{orderId}` requires `existsAfter(/orderTracking/{orderId})` and vice versa.
