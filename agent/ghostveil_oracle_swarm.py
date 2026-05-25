"""
GhostVeil Oracle Swarm

Swarms-ready marketplace agent scaffold for the ACM Hackathon.

Install:
    pip3 install -U swarms

Run:
    export SWARMS_API_KEY="your-api-key"
    python agent/ghostveil_oracle_swarm.py
"""

from __future__ import annotations

from textwrap import dedent

from swarms import Agent, SequentialWorkflow


MODEL_NAME = "gpt-4o-mini"


VEILSENSE_PROMPT = dedent(
    """
    You are VeilSense, the Solana signal scanner inside GhostVeil.

    Scan the user request for early Solana market signals across wallets,
    liquidity, launches, volume, social momentum, narratives, and
    counter-signals. Return only structured candidate signals.

    For each candidate include:
    - signal name
    - why it was detected
    - evidence
    - early-or-crowded stage
    - obvious risks
    - confidence from 0 to 100

    Do not give financial advice. Do not promise returns.
    """
).strip()


TRIBUNAL_PROMPT = dedent(
    """
    You are Alpha Tribunal, a multi-agent judge panel.

    Stress-test every candidate signal through bull, bear, risk, liquidity,
    crowding, MEV, hype quality, whale behavior, and timing perspectives.

    Reject weak, overhyped, manipulated, or crowded signals. If a signal
    survives, explain why. Return a final verdict: PASS, WATCH, or REJECT.
    """
).strip()


VEILGUARD_PROMPT = dedent(
    """
    You are VeilGuard, the privacy and safety layer.

    Separate private analysis from public output. Remove sensitive wallet
    intent, exact trade sizing, private strategy, and user-specific execution
    assumptions from public Alpha Cards.

    Keep useful public evidence, risk notes, and invalidation points.
    """
).strip()


GHOSTPROOF_PROMPT = dedent(
    """
    You are GhostProof, the Alpha Card publisher.

    Convert only verified signals into polished GhostVeil Alpha Cards.
    Use plain language and include:
    - Verdict
    - Opportunity
    - Why it matters now
    - Early or crowded stage
    - Stealth Score
    - Conviction Score
    - Risk Score
    - Evidence trail
    - Alpha Tribunal summary
    - GhostTrade Replay
    - Trade risk warnings
    - Invalidation points
    - Public X/Discord summary

    GhostTrade Replay is a timeline of how the signal appeared, what changed,
    why it was flagged, and what would prove the signal wrong. It does not
    execute trades or promise outcomes.
    """
).strip()


def build_ghostveil_workflow() -> SequentialWorkflow:
    veilsense = Agent(
        agent_name="VeilSense-Engine",
        model_name=MODEL_NAME,
        system_prompt=VEILSENSE_PROMPT,
        max_loops=1,
    )

    tribunal = Agent(
        agent_name="Alpha-Tribunal",
        model_name=MODEL_NAME,
        system_prompt=TRIBUNAL_PROMPT,
        max_loops=1,
    )

    veilguard = Agent(
        agent_name="VeilGuard-Privacy-Layer",
        model_name=MODEL_NAME,
        system_prompt=VEILGUARD_PROMPT,
        max_loops=1,
    )

    ghostproof = Agent(
        agent_name="GhostProof-Publisher",
        model_name=MODEL_NAME,
        system_prompt=GHOSTPROOF_PROMPT,
        max_loops=1,
    )

    return SequentialWorkflow(
        name="GhostVeil-Oracle-Swarm",
        description="Privacy-aware Solana alpha verification workflow.",
        agents=[veilsense, tribunal, veilguard, ghostproof],
        max_loops=1,
        team_awareness=True,
        multi_agent_collab_prompt=True,
        output_type="dict",
    )


def main() -> None:
    workflow = build_ghostveil_workflow()
    task = (
        "Scan Solana for hidden alpha in the last 6 hours. Filter weak signals, "
        "run a multi-agent debate, protect sensitive intent, and return one "
        "GhostVeil Alpha Card with scores, evidence, GhostTrade Replay, risk "
        "warnings, invalidation points, and a public share summary."
    )
    result = workflow.run(task)
    print(result)


if __name__ == "__main__":
    main()
