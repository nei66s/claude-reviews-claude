# Sandbox Agents

A sandbox gives an agent an isolated, Unix-like execution environment with a filesystem, shell, installed packages, mounted data, exposed ports, snapshots, and controlled access to external systems.

Agent workflows get brittle when the model needs that kind of workspace but only receives prompt context. Large document sets, generated artifacts, commands, previews, and resumable work all need an environment the agent can inspect and change.

> [!NOTE]
> Sandbox agents are currently only available in the Python Agents SDK. Documentation here serves as a reference for cross-platform implementation.

---

## Architecture: Harness vs. Compute

The key split is the boundary between the harness and compute. 

- **The Harness:** The control plane around the model. It owns the agent loop, model calls, tool routing, handoffs, approvals, tracing, recovery, and run state. 
- **Compute:** The sandbox execution plane where model-directed work reads and writes files, runs commands, installs dependencies, uses mounted storage, exposes ports, and snapshots state.

![Sandbox Agent Architecture](../assets/docs/sandbox_agents_architecture.png)

*Figure 1: (Left) Harness inside Sandbox for prototyping. (Right) Separated Harness and Sandbox for production.*

Keeping those boundaries separate lets your application keep sensitive control plane work in trusted infrastructure while the sandbox stays focused on provider-specific execution.

---

## When to use a Sandbox

Use a sandbox when the agent's answer depends on work done in a workspace, not just reasoning over prompt context.

### Common Use Cases:
- **Massive Context:** Task needs a directory of documents, not a single prompt.
- **Artifact Persistence:** Agent needs to write files (CSV, JSON, Markdown) for later inspection.
- **System Tools:** Agent needs commands, packages, or specific scripts.
- **Service Previews:** Running a notebook or report server on an exposed port.
- **Stateful Resumption:** Work pauses for human review and resumes in the same workspace.

---

## Sandbox Components

| Piece              | What it owns                                                     | Design question                                                                                   |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SandboxAgent`     | The agent definition plus sandbox defaults                       | What should this agent do, and which sandbox defaults travel with it?                             |
| `Manifest`         | The fresh-session workspace contract                             | What files, directories, repos, mounts, environment, users, or groups start out in the workspace? |
| Capabilities       | Sandbox-native behavior attached to the agent                    | Which sandbox tools, instructions, or runtime behavior does this agent need?                      |
| Sandbox client     | The provider integration                                         | Where should the live workspace run: Unix-local, Docker, or a hosted provider?                    |
| Sandbox session    | The live execution environment                                   | Where do commands run, files change, ports open, and provider state live?                         |
| `SandboxRunConfig` | Per-run sandbox session source, client options, and fresh inputs | Should this run inject, resume, or create the sandbox session?                                    |
| Saved state        | `RunState`, `session_state`, and snapshots                       | How should later runs reconnect to work or seed a new workspace?                                  |

---

## Capabilities

Capabilities attach sandbox-native behavior to a `SandboxAgent`.

| Capability   | Add it when                                                  | Notes                                                                                |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `Shell`      | The agent needs shell access.                                | Adds command execution and interactive input.                                        |
| `Filesystem` | The agent needs to edit files or inspect local images.       | Adds `apply_patch` and `view_image`.                                                 |
| `Skills`     | You want skill discovery and materialization in the sandbox. | Allows loading tools/scripts from Git or Local dirs.                                 |
| `Memory`     | Follow-on runs should read or generate memory artifacts.     | Requires `Shell` and `Filesystem`.                                                   |
| `Compaction` | Long-running flows need context trimming.                    | Adjusts model behavior after compaction.                                             |

---

## Example Implementation (Python SDK)

```python
import asyncio
from agents import Runner
from agents.run import RunConfig
from agents.sandbox import Manifest, SandboxAgent, SandboxRunConfig
from agents.sandbox.capabilities import Shell, Filesystem
from agents.sandbox.sandboxes.unix_local import UnixLocalSandboxClient

# 1. Define the starting workspace
manifest = Manifest(
    entries={
        "task_meta.md": File(content=b"# Project X\n- Target: Compliance review")
    }
)

# 2. Configure the Sandbox Agent
agent = SandboxAgent(
    name="Compliance Auditor",
    instructions="Review the workspace and generate a report.",
    default_manifest=manifest,
    capabilities=[Shell(), Filesystem()],
)

# 3. Execute
async def main():
    result = await Runner.run(
        agent,
        "Analyze the meta data and create report.md",
        run_config=RunConfig(
            sandbox=SandboxRunConfig(client=UnixLocalSandboxClient()),
        ),
    )
    print(result.final_output)

asyncio.run(main())
```

---

## Sandbox Providers

| Provider   | Best Use Case                                | Status       |
| ---------- | -------------------------------------------- | ------------ |
| Unix-local | Local development on macOS/Linux             | Supported    |
| Docker     | Local container isolation                    | Supported    |
| E2B        | Cloud sandboxes with code execution          | Supported    |
| Modal      | High-scale compute and GPU access            | Supported    |
| Cloudflare | Edge compute sandboxes                       | Supported    |
| Vercel     | Serverless deployment sandboxes              | Supported    |
