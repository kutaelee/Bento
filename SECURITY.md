# Security Policy

Bento handles private files, share links, access control, and local storage paths. Security issues should be reported privately before public disclosure.

## Supported Versions

Bento is currently pre-1.0. Security fixes are made on the default branch until the first stable release line is created.

## Reporting a Vulnerability

Email security reports to kutaelee0@gmail.com with:

- affected commit, branch, or release tag;
- impact and reproduction steps;
- whether private files, tokens, credentials, or host paths can be exposed or modified;
- any proof of concept that is safe to run locally.

Please do not include real secrets or private user data in reports.

## Areas of Interest

High-priority security areas include:

- path traversal or unsafe host path handling;
- share link token leakage or weak token storage;
- ACL inheritance bypasses;
- upload session corruption, overwrite, or executable upload paths;
- destructive storage scan, trash, migration, or cleanup behavior;
- authentication, refresh-token rotation, and invite-token handling.

## Disclosure

The maintainer will acknowledge credible reports as soon as possible, prioritize a fix, and publish a security note or release once users can update safely.
