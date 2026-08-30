# NodePulse APM SRS Baseline

- Baseline: `v1-pre-implementation`
- Status: Frozen and approved for implementation
- Source document: `SRS_NodePulse_APM.docx`
- Document version: `0.3`
- Frozen date: `2026-08-30` (Asia/Calcutta)
- File size: `20,740 bytes`
- SHA-256: `189D485BF3378DC5F44894B392D206AD99F2194B3C72CFB136D0B1F397808B72`

This checksum identifies the exact SRS approved as the v1 implementation baseline. Any requirements change must produce a new document version and a new baseline checksum; the record above should not be overwritten retroactively.

## Approved post-baseline decision

On 2026-08-30, complete-bucket-only reporting was approved as a requirements change: all metrics must use the same set of fully closed buckets, the dashboard must combine all completed buckets available in retention, and active-bucket data must remain hidden until closure. The original document and checksum above remain unchanged as the historical baseline; this decision must be incorporated when the source SRS is next versioned.
