# Security Policy

Security is an important part of SENTINEL's design and release process.

SENTINEL includes automated dependency scanning, static security analysis,
container vulnerability scanning, secret scanning, model-governance checks,
and isolated regression testing as part of its CI pipeline.

## Supported Versions

The current supported release line is:

| Version | Supported |
|---|---|
| 1.0.x | ✅ |
| Earlier development versions | ❌ |

Security fixes, when required, will be applied to the currently supported
release line.

## Reporting a Vulnerability

Please avoid publicly disclosing a suspected security vulnerability before it
has been reviewed.

If GitHub private vulnerability reporting is enabled for this repository, use
the repository's **Security → Report a vulnerability** workflow.

Otherwise, contact the maintainer through the GitHub profile associated with
this repository and provide enough information to reproduce and assess the
issue.

Please include, where possible:

- a clear description of the vulnerability;
- affected component or endpoint;
- steps to reproduce;
- expected and observed behavior;
- potential security impact;
- relevant logs, screenshots, or proof-of-concept details;
- any suggested remediation.

Please do not include real credentials, production secrets, or sensitive
third-party data in a report.

## Scope

Security reports may include issues involving:

- FastAPI backend behavior;
- API exposure or request handling;
- PostgreSQL interaction;
- Docker and Nginx configuration;
- dependency vulnerabilities;
- frontend security behavior;
- Local Ollama integration boundaries;
- model-artifact integrity or governance;
- simulator / operational trust-boundary violations;
- benchmark or ground-truth leakage;
- secret exposure;
- CI/CD security controls.

## Security Design Boundaries

Several SENTINEL boundaries are deliberate security properties:

- synthetic attack ground truth is excluded from operational inference;
- production model artifacts are validated before use;
- selected-model lineage is enforced;
- backend and Event Processor containers run with reduced privileges;
- production backend and PostgreSQL ports are not host-published by default;
- runtime health does not require Docker socket access;
- Local AI is optional and does not control anomaly detection or incident creation;
- benchmark infrastructure is isolated from the operational database.

A report showing that one of these boundaries can be bypassed is especially
valuable.

## Responsible Disclosure

Please allow reasonable time for investigation and remediation before any
public disclosure.

Confirmed security issues may result in:

- a patch;
- a dependency or container update;
- an updated model-governance contract;
- additional regression coverage;
- documentation changes;
- a security-focused maintenance release.

Thank you for helping improve SENTINEL.
