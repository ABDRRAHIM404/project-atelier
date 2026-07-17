# Storage Architecture

**Status:** Approved 2026-07-16  
**Recommended provider:** Amazon S3 with GuardDuty Malware Protection

## 1. Objectives

The storage architecture separates published media from private customer material, gives payment proofs additional protection, prevents unscanned uploads from becoming trusted, preserves historical versions, and supports database/object recovery reconciliation. It describes logical zones and access rules, not bucket names or infrastructure code.

## 2. Why not use database or local disk

Object bytes do not belong in PostgreSQL rows and cannot rely on ephemeral Vercel function disk. The database stores file identity, business relationship, classification, lifecycle, object version/reference, integrity metadata, and audit linkage. S3 stores bytes. A file is usable only when both the authoritative metadata and expected object version agree.

## 3. Logical storage zones

| Zone | Content | Public network access | Normal readers | Baseline controls |
|---|---|---|---|---|
| Public published media | Approved product/CMS images and basic media | Delivered through controlled CDN/image path; direct S3 public access remains blocked | Anyone | Publication workflow, immutable/versioned keys, cache policy, image budgets |
| Private customer | Project/message attachments and customer-visible private files | No | Owning Customer and authorized Manager via short-lived capability | Ownership checks, versioning, scan before use |
| Sensitive payment | Bank-transfer proof and verification evidence | No | Authorized Manager; limited Customer metadata/access per policy | Separate role/path, short expiry, scan, view audit, no public transform |
| Restricted operations | Internal exports, recovery artifacts, audit-related attachments | No | Operator or explicitly allowed Manager workflow | Strongest credentials, encryption controls, access audit |
| Quarantine | Newly uploaded or suspect objects | No | Scanner/operations only | No normal application delivery, scan state, automatic isolation |
| Recovery | Encrypted database exports and object inventories | No | Operator/recovery role only | Separate credentials/account boundary where feasible, versioning, restore-tested |

Physical bucket/account separation should at minimum prevent a public-media delivery role from reading sensitive or recovery objects. Exact bucket layout is an infrastructure design decision, but access isolation cannot depend only on a filename prefix checked by the browser.

## 4. Access model

Amazon S3 Block Public Access stays enabled for every bucket, including the published-media origin. Public delivery occurs through a narrowly configured CDN/image-delivery origin identity. Private access uses short-lived presigned operations or an authenticated application stream only after the server authorizes actor, object, action, and current lifecycle.

Presigned URLs are bearer capabilities. They are object- and operation-specific, short-lived, HTTPS-only, never written to persistent business records, never logged, and never cached in a shared response. Exact expiry is configuration subject to the shortest usable workflow.

Official controls: [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) and [presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).

## 5. Upload lifecycle

1. The authenticated actor requests an upload intent for an allowed business resource.
2. The server authorizes ownership/role/state, validates declared type and size, assigns classification, and creates an application-generated object key and pending metadata.
3. The server issues a restricted, short-lived upload capability.
4. The browser uploads directly to the quarantine/designated ingestion zone.
5. The server finalizes only the expected object, version, size, and integrity metadata; it inspects file signature/type rather than trusting the extension.
6. GuardDuty emits a scan result. Signature and replay validation protect the event path.
7. A clean result makes the file eligible for its domain workflow. Malicious content is isolated; failed/unsupported/missing results remain pending and create an operational recovery item.
8. Publication, if applicable, is a separate Manager-authorized action that creates/promotes a safe public rendition/reference and records audit/cache invalidation.

Direct upload success alone never makes a Payment Submission valid or a message attachment visible.

## 6. Allowed content and budgets

Payment proof is limited to the accepted JPG, PNG, and PDF formats. The effective byte/page/dimension limits remain configuration within the media budgets and policy decisions in the planning package. Scriptable SVG, HTML, and executable formats are not permitted for payment proof.

Catalog image variants are produced through an approved image pipeline and constrained by `QUALITY_GATES.md`. Advanced 360-degree asset workflow is outside Version 1 core; architecture does not provision a dedicated 360 processing pipeline. Original assets and public renditions have distinct metadata and lifecycle.

## 7. Versioning, immutability, and deletion

S3 Versioning is enabled for protected zones. Application operations use new object keys or versions rather than overwrite for historical attachments. The business record pins the exact object version or immutable key so a later upload cannot change what an accepted quotation, payment submission, message, or fulfilment proof refers to.

Retention and deletion periods are unresolved business/legal policies. Lifecycle rules are not activated with guessed durations. S3 Object Lock is considered for classes requiring write-once retention only after the retention period, legal need, governance mode, and recovery consequences are approved. Deletion is a governed, audited workflow that coordinates relational metadata, current object versions, prior versions, replicas, and legal holds.

## 8. Encryption and key management

TLS is required for all access. S3 server-side encryption is mandatory. Sensitive, restricted, and recovery zones should use customer-managed KMS keys if the operating cost and key-recovery responsibilities are approved. IAM roles are separated by application runtime, scanner, public delivery, backup writer, and recovery reader. No browser receives AWS credentials.

## 9. Backup and disaster recovery

Database backup does not back up S3 objects. S3 versioning, optional cross-account or cross-region replication after region/legal approval, and periodic object inventories protect object history. Reconciliation compares database file metadata with expected bucket, key, version, size, and checksum; discrepancies alert and do not auto-assign ownership.

Recovery tests use an isolated environment and confirm that private URLs remain private after restoration. Recovery-zone access is not shared with the normal application deletion role.

## 10. Storage events and observability

Object-created, scan-result, publication, access-denied, lifecycle, and deletion activity generate structured operational telemetry. GuardDuty scan events are at-least-once and therefore idempotently consumed. Security alerts include malicious findings, repeated scan failure, unexpected public-policy changes, unusual sensitive reads, reconciliation gaps, and recovery-role use.

GuardDuty behavior is described in [Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html).

## 11. Provider evaluation

### AWS S3 plus GuardDuty — final recommendation

- **Why it fits:** mature object versioning, precise IAM, independent recovery storage, optional Object Lock/replication, presigned operations, and managed S3 malware scanning.
- **Alternatives considered:** Supabase Storage, Cloudflare R2, Vercel Blob, and an external scanning service.
- **Tradeoffs:** adds an AWS control plane and event integration alongside Supabase/Vercel; egress and IAM are more complex than a single-provider stack.
- **Risks:** permission mistakes, bearer-URL leakage, scan-event gaps, uncontrolled version growth, KMS/key recovery failure.
- **Cost implications:** usage-based storage, requests, data transfer, old versions, KMS, GuardDuty scan volume, and possible CDN/replication costs. Current prices must be checked before approval at [S3 pricing](https://aws.amazon.com/s3/pricing/) and [GuardDuty pricing](https://aws.amazon.com/guardduty/pricing/).
- **Lock-in implications:** moderate operational lock-in; object APIs are widely compatible, but IAM, GuardDuty, KMS, Object Lock, and event behavior are AWS-specific.
- **ADR status:** Accepted with staged adoption (ADR-016).

### Why Supabase Storage is not the primary recommendation

Supabase Storage integrates conveniently with Supabase authorization and exposes S3 compatibility, but its current S3 compatibility does not support object versioning and database backups do not include stored objects. Those constraints make the accepted private-file recovery and historical-object requirements harder to satisfy without another backup system. It remains a viable alternative if the Product Owner accepts a separate versioned backup/scan architecture. See [Supabase S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility).

## 12. Remaining policy and configuration points

AWS S3 and GuardDuty with staged adoption are accepted. Account/region topology, KMS usage, CDN activation, version/lifecycle budgets, replication, Object Lock, file limits, retention/deletion policies, and malware-response procedure remain policy or configuration points. None may be silently inferred during implementation.
