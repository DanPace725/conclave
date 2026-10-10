# Distinct local Conclave plugin identity

October 8, 2026. Local configuration and package-generator change; no publication or deployment.

Local plugins now display `conclave_local`, use package name `conclave-local`, and declare MCP namespace `conclave_local`. Hosted templates retain their existing `conclave-handoffs` identity, presentation and `conclave` namespace. The optional ChatGPT tunnel workflow package uses the local identity and app alias while retaining the registered app ID. The account-side tunnel connection has not been renamed.

Regenerated this checkout's ignored local configuration/package files and its existing optional ChatGPT app mapping. Verified installation in an isolated Codex configuration, then installed/enabled `conclave-local@conclave-local` in the user's configuration and removed the former `conclave-handoffs@conclave-local` installation. Parsed configuration comparison confirms that unrelated settings and plugin enablement are preserved. The installed package's presentation, six callable MCP tools, launcher and local data paths were checked against the former generated configuration.

Claude Desktop's existing local `conclave` entry was verified to launch this checkout, backed up, and renamed to `conclave_local`. Readback and structural comparison confirm the launcher, storage and all other settings are preserved. Original configuration backups remain under ignored `.conclave/local-rename-check/`. Restart/fresh-session acceptance in the apps remains unverified. Claude Code plugin installation remains a separate setup step.

Validation: five focused integration tests pass, including independent cached stdio clients resuming the same durable fixture packet and unchanged hosted transport generation; `npm run check` passes; Converse parity matches 106 managed files. Package-generator files are outside the managed Converse snapshot, so no migration was needed. No real packet write or model call was performed for this rename.
