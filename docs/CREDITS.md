# Credits, Licenses, and Intellectual Attribution
> **DataForge x Pathway Hackathon: "Explain the Frontier"**  
> Project: Inference-Time Scaling Explainer via Recurrent Latent-Space Reasoning

This document provides a comprehensive, transparent inventory of all fonts, libraries, algorithms, architectures, and intellectual inspirations utilized in this repository.

---

## 1. Web Fonts & Typography

The interactive web artifact (`site/`) loads fonts via Google Fonts CDN under permissive open-source licenses:

| Font Family | Designer / Foundry | License | Usage in Artifact | Canonical Repository / License URL |
|---|---|---|---|---|
| **Inter** | Rasmus Andersson | [SIL Open Font License 1.1](https://openfontlicense.org/) | Primary sans-serif UI typeface (`--font-sans`) for headings, body copy, and metadata badges. | [github.com/rsms/inter](https://github.com/rsms/inter) |
| **JetBrains Mono** | JetBrains | [SIL Open Font License 1.1](https://openfontlicense.org/) | Primary monospace typeface (`--font-mono`) for metrics, slider values, and code readouts. | [github.com/JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) |
| **Space Grotesk** | Florian Karsten | [SIL Open Font License 1.1](https://openfontlicense.org/) | Designated secondary heading display font fallback in design documentation. | [github.com/floriankarsten/space-grotesk](https://github.com/floriankarsten/space-grotesk) |
| **IBM Plex Mono** | Mike Abbink / Bold Monday | [SIL Open Font License 1.1](https://openfontlicense.org/) | Designated tabular monospace fallback in stylesheet system. | [github.com/IBM/plex](https://github.com/IBM/plex) |

---

## 2. Web Client Code & Frameworks

- **Runtime Frameworks**: **Zero third-party JavaScript or CSS frameworks.**
- The interactive explainer (`site/index.html`, `site/app.js`, `site/style.css`) is written entirely in **pure vanilla ES6+ and Vanilla CSS**.
- **Vector Rendering**: All maze graphics and scaling curves are rendered procedurally as native vector Scalable Vector Graphics (SVG) elements constructed via DOM APIs inside `site/app.js`. No charting libraries (e.g., Chart.js, D3, Plotly) or canvas wrapper packages were imported or bundled.
- **Dependencies**: No `npm`, `webpack`, `vite`, or external node module dependencies are required to execute or serve the client.

---

## 3. Algorithmic Sources & Procedural Logic

| Algorithm | Source / Heritage | File Reference | Description |
|---|---|---|---|
| **Recursive Backtracker (DFS)** | Classic randomized depth-first search spanning-tree algorithm on a grid graph. | `ml/generate_mazes.py` (`generate_maze`) | Generates perfect, loop-free 2D mazes with single-corridor passages and guaranteed global reachability between Start $(0,0)$ and Goal $(14,14)$. |
| **Breadth-First Search (BFS)** | Classic queue-based shortest-path algorithm for unweighted planar graphs. | `ml/generate_mazes.py` (`solve_maze_bfs`) | Computes ground-truth optimal shortest path mask connecting start to goal. |
| **Intersection over Union (IoU)** | Jaccard similarity index ($\frac{|A \cap B|}{|A \cup B|}$) widely used in spatial segmentation. | `ml/evaluate.py`, `site/app.js` | Evaluates continuous partial-credit overlap between predicted path probabilities and ground-truth coordinates. |

---

## 4. Model Architecture & Theoretical Inspiration

The machine learning implementation (`ml/model.py`, `ml/train.py`, `ml/evaluate.py`) builds on research in recurrent latent dynamics and test-time compute scaling:

1. **Recurrent Latent Reasoning Architecture**:
   - **Foundational Biological & Algorithmic Bridge**: Kosowski et al. (2025), *"The Dragon Hatchling: The Missing Link Between the Transformer and Models of the Brain"* ([arXiv:2509.26507](https://arxiv.org/abs/2509.26507)). Introduces the BDH family where internal state recurrently updates in latent space.
   - **In-Context Latent Reasoning Benchmark**: Kosowski et al. (2026), *"BDH-CQ: In-Context Learning with Recurrent Latent Reasoning"* ([arXiv:2608.09888](https://arxiv.org/abs/2608.09888)). Evaluates variable reasoning effort on ARC-AGI-1 without emitting intermediate verbal tokens (Table 5).
2. **Convolutional Gated Recurrence (ConvGRU)**:
   - ConvGRU formulation follows the standard mathematical equations introduced by Ballas et al. (2015), *"Delving Deeper into Convolutional Networks with Shape-Preserving Recurrent Models"* ([arXiv:1511.06432](https://arxiv.org/abs/1511.06432)); the module in `ml/model.py` is an independent implementation written from scratch, not adapted from their codebase.
3. **Inference-Time Scaling Principles**:
   - Snell et al. (2024), *"Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters"* ([arXiv:2408.03314](https://arxiv.org/abs/2408.03314)). Formalizes test-time compute allocation trade-offs against parameter scaling.
   - Goyal et al. (2024), *"Think before you speak: Training Language Models With Pause Tokens"* (ICLR 2024 / [arXiv:2310.02226](https://arxiv.org/abs/2310.02226)). Motivates non-verbalized computational pauses during neural inference.

---

## 5. Third-Party Assets & Dataset Verification

- **Proprietary / Third-Party Datasets**: **None.** No proprietary, scraped, or external image datasets were used. 100% of training and evaluation mazes were synthesized deterministically by local code with fixed seeds.
- **Pretrained Weights**: **None.** The PyTorch model checkpoint (`ml/checkpoints/best_model.pt`, 123,713 parameters) was trained from scratch locally on synthetic procedural mazes.
- **Copyrighted Images / Media**: **None.** The repository contains zero raster photos, proprietary icons, or scraped visual media.

---

## 6. Repository Licensing

- The entirety of the original source code, training scripts, evaluation harnesses, and web interface is distributed under the **MIT License** (see [LICENSE](../LICENSE)).
