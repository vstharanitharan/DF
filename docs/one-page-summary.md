# Inference-Time Scaling in Latent Space: Recurrent Non-Verbal Reasoning
**Track Submission**: DataForge x Pathway — *Explain the Frontier*  
**Interactive Web Explainer**: [https://theshrihari.github.io/Dataforge-Submission/](https://theshrihari.github.io/Dataforge-Submission/) | **Repository**: [https://github.com/TheShriHari/Dataforge-Submission](https://github.com/TheShriHari/Dataforge-Submission)  
**Topic**: Test-Time Compute Scaling & Recurrent Latent Reasoning (BDH / BDH-CQ)

---

### 1. Central Claim
> **"Increasing the number of recurrent latent computation steps at inference time can improve reasoning accuracy without producing any additional natural-language reasoning tokens — but gains diminish and each extra step costs more compute/time."**

---

### 2. Design Motivation: Latent Iteration vs. Verbalized Chain-of-Thought
Current LLM test-time scaling primarily relies on autoregressive Chain-of-Thought (CoT) prompting or search sampling (Snell et al., 2024, [arXiv:2408.03314](https://arxiv.org/abs/2408.03314)). While effective, verbalized CoT suffers from severe architectural bottlenecks:
1. **Context & Memory Bloat**: Every verbalized reasoning token appends to the context window, causing $O(N^2)$ self-attention cost and quadratic Key-Value (KV) cache expansion.
2. **Syntactic Fragility & Drift**: Verbal reasoning demands strict grammatical adherence; an early hallucination or syntactic failure permanently derails subsequent steps.
3. **Contrast with Standard Forward Passes**: Standard Transformer or feedforward CNN passes apply a static layer sequence where compute is strictly bound to parameter depth $L$. In contrast, **recurrent latent iteration** loops hidden states through a weight-shared core for $K$ discrete iterations:
   $$h_k = \text{Core}(h_{k-1}, x) \quad \text{for } k \in [1, K]$$
   This decouples inference compute budget from parameter count, preserving a constant tensor memory footprint ($h \in \mathbb{R}^{C \times H \times W}$) with zero emitted text tokens.

---

### 3. Technical Mechanism & Measured Trade-Offs
Our implementation evaluates this mechanism on 2D maze pathfinding, where long-range connectivity requires deep propagation. Using a 123,713-parameter shared Convolutional GRU (ConvGRU) core (`ml/model.py`), each recurrence step $k$ expands the effective receptive field by 2 grid cells.

Measured across $N=100$ held-out $15 \times 15$ synthetic mazes (Seed 999, `results/accuracy_by_effort.json`):
- **Steep Early Accuracy Phase ($K=1 \to 10$)**: Exact solve rate climbs from **1.0%** ($K=1$, 0.666 ms) to **44.0%** ($K=5$, 2.911 ms) and **81.0%** at $K=10$ (6.155 ms). Path IoU rises from **55.94%** to **96.61%**, reflecting rapid topological discovery.
- **Empirical Diminishing Returns ($K=10 \to 20$)**: Increasing $K$ from 10 to 20 yields only a **$+7.0\%$** gain in solve rate (81.0% $\to$ 88.0%) and plateaued Path IoU (96.61% $\to$ 98.13%), while latency more than doubles from **6.155 ms to 12.884 ms/maze**.
- **Training Horizon & Generalization**: $K=16–20$ extends beyond the $K \sim \text{Uniform}(1, 15)$ training curriculum (`ml/train.py`). The model generalizes because the recurrent core is weight-shared and lacks step-count parameters, but this was not part of the training distribution.

---

### 4. Multi-Dimensional Paradigm Comparison

| Dimension | Toy Latent Maze Solver (Our Artifact) | BDH-CQ Foundation Model (Kosowski et al., 2026) | Autoregressive Search / CoT (Snell et al., 2024) |
|---|---|---|---|
| **Domain & Scale** | 2D Spatial Pathfinding ($15 \times 15$), 123K params. | ARC-AGI-1 Abstract Reasoning, ~150M params. | Symbolic Math & Language Benchmarks, >7B params. |
| **Effort vs. Accuracy** | Solves scale from **1.0% ($K=1$) to 88.0% ($K=20$)**; steep early gains, plateauing at $K \ge 11$. | Pass@2 scales from **21.0% (Low) to 29.5% (High)** on ARC-AGI-1 (Table 5). | Accuracy scales with sample budget $N$ and search beam depth. |
| **Inference Hardware Cost** | Latency scales linearly from $0.666$ ms ($K=1$) to $12.884$ ms ($K=20$). | Low effort cuts hardware compute cost by **22.0%** (Medium cuts by **11.0%**) vs. High effort. | Exponentially growing KV-cache and sequence compute cost ($O(N^2)$). |
| **Memory Footprint** | Constant $O(1)$ tensor state ($\mathbb{R}^{48 \times 15 \times 15}$). | Constant latent state manifold during recurrent updates. | Linear-to-quadratic memory expansion per generated token. |
| **Observability** | Continuous probability readout via 1x1 projection head. | Continuous hidden activations (non-symbolic latent space). | High: Human-readable natural language reasoning transcripts. |

---

### 5. Architectural Roles: BDH vs. BDH-CQ
To preserve technical precision, the two literature systems are distinguished:
- **The Dragon Hatchling (BDH)** (Kosowski et al., 2025, [arXiv:2509.26507](https://arxiv.org/abs/2509.26507)): A biologically-inspired, post-transformer foundational architecture that establishes recurrent latent state updates and non-autoregressive parallel processing across continuous representations.
- **BDH-CQ** (Kosowski et al., 2026, [arXiv:2608.09888](https://arxiv.org/abs/2608.09888)): A specialized system built within the BDH family incorporating in-context demonstration learning ("Context Queries") and test-time effort modulation across LOW, MEDIUM, and HIGH budgets without emitting scratchpad text tokens.

---

### 6. Evidence Classification: Strengths, Weaknesses, and Maturity
- **Advantage Over Incumbents**: Recurrent latent iteration eliminates $O(N^2)$ KV-cache bloat and syntax drift, enabling variable-effort inference within a fixed memory envelope.
- **Where It Performs Worse / Remains Untested**: Untested on open-ended natural language generation where sequential text tokens are the required output modality.
- **Our Experimental Results**: Classified as **own toy implementation, empirically measured, not independently audited** on synthetic 2D mazes.
- **BDH-CQ External Baseline**: ARC-AGI-1 score (29.5% pass@2) is **developer-reported, partially independently audited by Bielik/NYU for the headline score only**. The internal scaling ablation (Table 5: 21.0% / 27.0% / 29.5% across effort tiers) is developer-reported and not independently reproduced.

---

### 7. Primary Limitation & Open Question
While recurrent latent scaling avoids token-generation overhead, it introduces a key bottleneck: **latent reasoning lacks explicit symbolic auditability**. If a model fails at step $K=4$, diagnosing whether failure stemmed from representation saturation, gradient vanishing, or feature drift requires probing classifiers rather than reading an English scratchpad. Developing standardized, zero-overhead probing techniques for continuous recurrent latent trajectories remains a crucial open research question.

---

### 8. Where to Continue Learning
- **BDH Foundations**: Kosowski et al. (2025), *"The Dragon Hatchling"*, [arXiv:2509.26507](https://arxiv.org/abs/2509.26507) and code: [github.com/pathwaycom/bdh](https://github.com/pathwaycom/bdh).
- **BDH-CQ Technical Report**: Kosowski et al. (2026), [arXiv:2608.09888](https://arxiv.org/abs/2608.09888).
- **Test-Time Compute Theory**: Snell et al. (2024), [arXiv:2408.03314](https://arxiv.org/abs/2408.03314).
- **Interactive Explainer & Verification**: Live app, empirical plots, and step traces: [https://theshrihari.github.io/Dataforge-Submission/](https://theshrihari.github.io/Dataforge-Submission/).
