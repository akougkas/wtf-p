---
fixture_id: nsf25-531-proposal-uat
fixture_version: 2
document_type: grant-proposal
source_class: call-evidence
status: incomplete-until-user-downloads-and-hashes
---

# Official-source receipt template

Complete this receipt from the exact files you download for the run. Do not copy a hash from documentation, leave a fabricated example hash, or claim that a URL was captured when the local file is absent.

| Source | Exact official URL | Required local path | Retrieval time (UTC) | SHA-256 of local bytes |
|---|---|---|---|---|
| NSF 25-531 solicitation | https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure/nsf25-531/solicitation | `materials/nsf25-531-solicitation.html` | **REQUIRED: actual UTC timestamp** | **REQUIRED: user-computed 64-character lowercase hex** |
| CICI program page | https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure | `materials/nsf-cici-program-page.html` | **REQUIRED: actual UTC timestamp** | **REQUIRED: user-computed 64-character lowercase hex** |
| PAPPG landing page | https://www.nsf.gov/policies/pappg | `materials/nsf-pappg-landing.html` | **REQUIRED: actual UTC timestamp** | **REQUIRED: user-computed 64-character lowercase hex** |

One safe way to materialize the official pages before starting Clio is:

```bash
curl --fail --silent --show-error --location --output materials/nsf25-531-solicitation.html \
  'https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure/nsf25-531/solicitation'
curl --fail --silent --show-error --location --output materials/nsf-cici-program-page.html \
  'https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure'
curl --fail --silent --show-error --location --output materials/nsf-pappg-landing.html \
  'https://www.nsf.gov/policies/pappg'
sha256sum materials/nsf25-531-solicitation.html \
  materials/nsf-cici-program-page.html \
  materials/nsf-pappg-landing.html
```

After recording the real values, verify all three files are regular files inside the project and that each recorded digest matches a fresh `sha256sum`. The solicitation controls call requirements; the program page supplies current status evidence; the PAPPG landing page identifies the policy source that must be rechecked for the actual submission date.

This receipt does not establish eligibility, institutional approval, budget accuracy, PAPPG compliance, or submission readiness.
