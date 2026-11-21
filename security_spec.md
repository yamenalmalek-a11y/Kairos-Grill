# Kairos Grill — Security Specification

## 1. Data Invariants
1. **Strict PII Isolation**: Customer names, phone numbers, delivery addresses, and GPS coordinates reside exclusively in `/orders/{orderId}`. Neither `get` nor `list` on `/orders` is permitted to anyone other than verified restaurant administrators (`isAdmin()`).
2. **Non-PII Live Tracking**: Customers track status changes via `/orderTracking/{orderId}`, which contains zero PII and uses a high-entropy random document ID (`size() >= 20`). Collection `list` on `/orderTracking` is restricted strictly to `isAdmin()`.
3. **Atomic Order Dispatch**: Creating `/orders/{orderId}` requires `existsAfter(/databases/$(database)/documents/orderTracking/$(orderId))`, and creating `/orderTracking/{orderId}` requires `existsAfter(/databases/$(database)/documents/orders/$(orderId))`.
4. **Admin-Only State Transitions**: Only verified `isAdmin()` accounts can read customer orders or update order statuses (`accepted`, `preparing`, `delivering`, `completed`, `cancelled`).
5. **Complaints PII Isolation & Write-Only Intake**: Customers may submit (`create`) complaints under `/complaints/{complaintId}` with high-entropy IDs (`size() >= 20`), enforced field limits, initial `status == 'new'`, and empty `adminNote == ''`. Only verified `isAdmin()` accounts (`YamenAlmalek@gmail.com`) may read (`get`/`list`), update status/adminNote, or delete complaints.
6. **Gated Management App Access**: Installing/opening the Admin kitchen & complaints view requires Google Sign-In verified against `ADMIN_EMAIL` (`YamenAlmalek@gmail.com`).

