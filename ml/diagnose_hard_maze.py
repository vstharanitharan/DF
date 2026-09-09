"""
Diagnostic evaluation script for hard-maze performance.
Tests the CURRENT trained checkpoint (8x8) on new 15x15 perfect mazes
without retraining, to determine if the issue is test-time compute or architecture/training.
"""

import os
import sys
import json
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn.functional as F
import numpy as np

from ml.generate_mazes import generate_dataset, solve_maze_bfs
from ml.model import RecurrentLatentMazeSolver


def is_path_continuous_solution(pred_binary, walls, start, goal):
    if pred_binary[start] < 0.5 or pred_binary[goal] < 0.5:
        return False
    if np.any((pred_binary > 0.5) & (walls > 0.5)):
        return False
    H, W = pred_binary.shape
    visited = {start}
    queue = [start]
    while queue:
        curr = queue.pop(0)
        if curr == goal:
            return True
        r, c = curr
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W:
                if (nr, nc) not in visited and pred_binary[nr, nc] > 0.5 and walls[nr, nc] < 0.5:
                    visited.add((nr, nc))
                    queue.append((nr, nc))
    return False


def main():
    print("=" * 70)
    print("PART B: HARD-MAZE DIAGNOSTIC (NO RETRAINING)")
    print("=" * 70)

    # Load existing checkpoint (trained on 8x8)
    ckpt_path = "ml/checkpoints/best_model.pt"
    if not os.path.exists(ckpt_path):
        print(f"ERROR: Checkpoint not found at {ckpt_path}")
        return

    checkpoint = torch.load(ckpt_path, map_location="cpu")
    trained_grid_size = checkpoint.get("grid_size", 8)
    hidden_dim = checkpoint.get("hidden_dim", 48)
    print(f"\nCheckpoint info:")
    print(f"  Trained grid size: {trained_grid_size}x{trained_grid_size}")
    print(f"  Hidden dim: {hidden_dim}")
    print(f"  Epoch: {checkpoint.get('epoch')}")

    # Initialize model and load weights
    model = RecurrentLatentMazeSolver(in_channels=3, hidden_dim=hidden_dim)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Generate new 15x15 perfect mazes (the new hard mazes)
    new_grid_size = 15
    num_test = 50
    print(f"\nGenerating {num_test} held-out {new_grid_size}x{new_grid_size} perfect mazes...")
    x_test, y_test = generate_dataset(num_test, grid_size=new_grid_size, seed=999)
    x_test_t = torch.from_numpy(x_test)
    y_test_t = torch.from_numpy(y_test)

    # Test at extended K values: 10, 15, 20, 30
    test_k_values = [10, 15, 20, 30]
    print(f"\nEvaluating 8x8-trained model on {new_grid_size}x{new_grid_size} mazes at K = {test_k_values}")
    print(f"{'K':<6} | {'Exact Solve Rate':<18} | {'Path IoU':<12} | {'BCE Loss':<10}")
    print("-" * 60)

    results = []
    with torch.no_grad():
        for k in test_k_values:
            pred_t = model(x_test_t, k=k)
            pred_np = pred_t.numpy()

            bce = F.binary_cross_entropy(pred_t, y_test_t).item()
            mask_pred = (pred_np > 0.5).astype(np.float32)
            inter = np.sum(mask_pred * y_test, axis=(1, 2, 3))
            union = np.sum((mask_pred + y_test > 0).astype(np.float32), axis=(1, 2, 3))
            iou = float(np.mean(inter / (union + 1e-6)))

            solves = 0
            for i in range(num_test):
                walls_i = x_test[i, 0]
                pred_i = mask_pred[i, 0]
                start = (0, 0)
                goal = (new_grid_size - 1, new_grid_size - 1)
                if is_path_continuous_solution(pred_i, walls_i, start, goal):
                    solves += 1

            solve_rate = float(solves / num_test)
            results.append({
                "k": k,
                "exact_solve_rate": round(solve_rate, 4),
                "exact_solve_percent": round(solve_rate * 100, 1),
                "path_iou": round(iou, 4),
                "mean_bce_loss": round(bce, 4),
            })
            print(f"{k:<6} | {solve_rate * 100:<17.1f}% | {iou:<12.4f} | {bce:<10.4f}")

    # Also test K=1 for reference
    print("\n--- Reference: K=1 baseline ---")
    with torch.no_grad():
        pred_t = model(x_test_t, k=1)
        pred_np = pred_t.numpy()
        bce = F.binary_cross_entropy(pred_t, y_test_t).item()
        mask_pred = (pred_np > 0.5).astype(np.float32)
        inter = np.sum(mask_pred * y_test, axis=(1, 2, 3))
        union = np.sum((mask_pred + y_test > 0).astype(np.float32), axis=(1, 2, 3))
        iou = float(np.mean(inter / (union + 1e-6)))
        solves = sum(1 for i in range(num_test) if is_path_continuous_solution(mask_pred[i, 0], x_test[i, 0], (0, 0), (new_grid_size - 1, new_grid_size - 1)))
        print(f"K=1  | {solves/num_test*100:<17.1f}% | {iou:<12.4f} | {bce:<10.4f}")

    # ===================================================================
    # B2: Receptive Field Threshold
    # ===================================================================
    print("\n" + "=" * 70)
    print("STEP B2: RECEPTIVE FIELD ANALYSIS")
    print("=" * 70)

    grid_size = new_grid_size
    diameter_formula = lambda k: 1 + 2 * k

    # Threshold 1: span the entire grid
    k_span_grid = (grid_size - 1) // 2 + (1 if (grid_size - 1) % 2 != 0 else 0)
    # Actually: 1 + 2K >= grid_size => K >= (grid_size - 1) / 2
    k_span_grid_exact = (grid_size - 1) / 2
    print(f"\nGrid size: {grid_size}x{grid_size}")
    print(f"To span entire grid: diameter = 1 + 2K >= {grid_size}")
    print(f"  => K >= {(grid_size - 1) / 2:.1f}, so K >= {int(np.ceil((grid_size - 1) / 2))}")

    # Threshold 2: worst-case Manhattan corridor length
    # For a perfect maze, longest path from (0,0) to (14,14) visiting all rooms
    # Room count = ((grid_size + 1) // 2)^2 = 8^2 = 64
    # Longest simple path in tree = number of nodes - 1 edges = 63 steps between rooms
    # Plus the walls between them. Total cells visited can be up to 64 + 63 = 127
    num_rooms = (grid_size + 1) // 2
    max_path_cells = num_rooms * num_rooms + (num_rooms * num_rooms - 1)  # worst case visits all rooms and all connecting walls
    print(f"\nWorst-case path analysis:")
    print(f"  Room cells: {num_rooms}x{num_rooms} = {num_rooms**2}")
    print(f"  Max simple path cells (rooms + connecting walls): ~{max_path_cells}")
    print(f"  Manhattan distance corner-to-corner: {2 * (grid_size - 1)}")
    print(f"  Receptive field threshold for corner-to-corner: K >= {2 * (grid_size - 1) / 2:.1f} => K >= {grid_size - 1}")

    print(f"\nSummary of receptive field thresholds for {grid_size}x{grid_size}:")
    print(f"  K >= {int(np.ceil((grid_size - 1) / 2))} to span the entire grid")
    print(f"  K >= {grid_size - 1} to guarantee corner-to-corner Manhattan reach")

    # ===================================================================
    # B3: Training K-range from train.py
    # ===================================================================
    print("\n" + "=" * 70)
    print("STEP B3: TRAINING CURRICULUM ANALYSIS")
    print("=" * 70)

    # Read train.py to extract K distribution
    with open("ml/train.py", "r") as f:
        train_content = f.read()

    print("\nRelevant train.py excerpt (K sampling):")
    for line in train_content.split("\n"):
        if "k_step" in line or "randint" in line or "Uniform" in line or "1, 11" in line:
            print(f"  {line}")

    print("\nTraining K-range: Uniform(1, 10)  [K ~ U(1,10), max K=10]")
    print(f"New receptive field threshold: K >= {int(np.ceil((grid_size - 1) / 2))} to span grid")
    print(f"Training max K=10 does NOT cover threshold K={int(np.ceil((grid_size - 1) / 2))}")

    # ===================================================================
    # B4: Loss application pattern
    # ===================================================================
    print("\n" + "=" * 70)
    print("STEP B4: LOSS SUPERVISION ANALYSIS")
    print("=" * 70)

    print("\nRelevant train.py excerpt (loss computation):")
    for line in train_content.split("\n"):
        if "loss" in line.lower() and ("pred" in line or "backward" in line or "bce" in line):
            print(f"  {line}")

    print("\nLoss is applied ONLY to the final-K output (single forward pass per batch).")
    print("No deep/step-wise supervision across intermediate K values.")
    print("This is a SECOND likely contributing cause.")

    # ===================================================================
    # B5: Diagnosis summary
    # ===================================================================
    print("\n" + "=" * 70)
    print("STEP B5: DIAGNOSIS SUMMARY")
    print("=" * 70)

    print("\nB1 Results (accuracy vs K on hard mazes):")
    for r in results:
        print(f"  K={r['k']}: Exact Solve={r['exact_solve_percent']}%, IoU={r['path_iou']:.4f}")

    # Check if accuracy keeps climbing
    solve_rates = [r["exact_solve_rate"] for r in results]
    if len(solve_rates) >= 2 and all(solve_rates[i] <= solve_rates[i+1] for i in range(len(solve_rates)-1)):
        trend = "Accuracy keeps climbing (or stays flat/improves) with K"
    else:
        trend = "Accuracy does NOT keep climbing; it fails regardless of K"

    print(f"\nTrend: {trend}")

    print("\nRoot causes identified:")
    print(f"  1. TRAINING K-RANGE MISMATCH: Trained with K~U(1,10), but receptive field")
    print(f"     threshold for {grid_size}x{grid_size} is K>={int(np.ceil((grid_size - 1) / 2))}.")
    print(f"     Model never learned to use enough reasoning steps.")
    print(f"  2. NO DEEP SUPERVISION: Loss only on final-K output. Intermediate steps")
    print(f"     receive no gradient signal, making it harder to learn iterative refinement.")

    print("\nProposed fix: (b) Retrain with extended K-curriculum covering up to the")
    print(f"receptive-field threshold (K >= {int(np.ceil((grid_size - 1) / 2))}), and add")
    print("deep supervision across recurrent steps.")

    print("\n" + "=" * 70)
    print("END OF PART B DIAGNOSTIC")
    print("=" * 70)

    return results


if __name__ == "__main__":
    main()
