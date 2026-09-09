"""
Synthetic maze generator and BFS path solver for the latent reasoning pipeline.
Produces deterministic NxN mazes guaranteed to be solvable, with 3-channel input
encodings and binary shortest-path target masks.
"""

from collections import deque
from typing import List, Optional, Tuple
import numpy as np


def generate_maze(
    num_rooms: int = 8,
    seed: Optional[int] = None,
) -> Tuple[np.ndarray, Tuple[int, int], Tuple[int, int]]:
    """
    Generate a perfect maze using Recursive Backtracker (randomized DFS).
    Works on an internal grid of size (2*num_rooms-1) x (2*num_rooms-1).
    Room cells are at even indices (0, 2, 4, ...); wall cells are at odd indices.
    The result is a perfect maze: single-cell-wide corridors, exactly one path
    between any two points, no loops, no open rooms.

    Returns:
        grid: (size, size) float32 array where 1.0 = wall, 0.0 = passage
        start: (0, 0)
        goal: (size-1, size-1)
    """
    size = 2 * num_rooms - 1
    grid = np.ones((size, size), dtype=np.float32)
    start = (0, 0)
    goal = (size - 1, size - 1)

    if seed is not None:
        rng = np.random.RandomState(seed)
    else:
        rng = np.random.RandomState()

    # Carve using recursive backtracker on the room-cell graph
    stack = [start]
    visited = {start}
    grid[start] = 0.0

    while stack:
        curr = stack[-1]
        r, c = curr
        # Unvisited room cells exactly 2 steps away (up/down/left/right)
        neighbors = []
        for dr, dc in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < size and 0 <= nc < size and (nr, nc) not in visited:
                neighbors.append((nr, nc))

        if neighbors:
            nxt = neighbors[rng.randint(len(neighbors))]
            # Carve the wall cell directly between current and chosen neighbor
            wr, wc = (curr[0] + nxt[0]) // 2, (curr[1] + nxt[1]) // 2
            grid[wr, wc] = 0.0
            grid[nxt] = 0.0
            visited.add(nxt)
            stack.append(nxt)
        else:
            stack.pop()

    # Ensure start and goal are open (they should already be)
    grid[start] = 0.0
    grid[goal] = 0.0

    return grid, start, goal


def solve_maze_bfs(
    maze_grid: np.ndarray,
    start: Tuple[int, int] = (0, 0),
    goal: Optional[Tuple[int, int]] = None,
) -> Optional[List[Tuple[int, int]]]:
    """
    Breadth-First Search to find the shortest path from start to goal.
    Returns list of coordinates [(r, c), ...] along the shortest path, or None if no path.
    """
    height, width = maze_grid.shape
    if goal is None:
        goal = (height - 1, width - 1)

    if maze_grid[start] != 0.0 or maze_grid[goal] != 0.0:
        return None

    queue = deque([start])
    visited = {start: None} # child -> parent mapping

    while queue:
        curr = queue.popleft()
        if curr == goal:
            break

        r, c = curr
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < height and 0 <= nc < width and maze_grid[nr, nc] == 0.0:
                neighbor = (nr, nc)
                if neighbor not in visited:
                    visited[neighbor] = curr
                    queue.append(neighbor)

    if goal not in visited:
        return None

    # Reconstruct path from goal back to start
    path = []
    curr = goal
    while curr is not None:
        path.append(curr)
        curr = visited[curr]
    path.reverse()
    return path


def generate_dataset(
    num_samples: int,
    grid_size: int = 15,
    seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates a dataset of mazes and their optimal shortest path masks.
    Args:
        grid_size: final grid dimension (must be odd). Internally uses
                   num_rooms = (grid_size + 1) // 2 traversable room cells per side.
    Returns:
      inputs: (num_samples, 3, grid_size, grid_size)
              channel 0: walls (1.0 = wall, 0.0 = passage)
              channel 1: start mask (1.0 at start, 0.0 elsewhere)
              channel 2: goal mask (1.0 at goal, 0.0 elsewhere)
      targets: (num_samples, 1, grid_size, grid_size)
              channel 0: binary mask of cells on the optimal shortest path
    """
    if grid_size % 2 == 0:
        raise ValueError(f"grid_size must be odd for perfect maze generation, got {grid_size}")
    num_rooms = (grid_size + 1) // 2

    inputs = np.zeros((num_samples, 3, grid_size, grid_size), dtype=np.float32)
    targets = np.zeros((num_samples, 1, grid_size, grid_size), dtype=np.float32)

    rng = np.random.RandomState(seed)

    for i in range(num_samples):
        sample_seed = int(rng.randint(0, 1_000_000_000))
        grid, start, goal = generate_maze(num_rooms=num_rooms, seed=sample_seed)
        path = solve_maze_bfs(grid, start, goal)

        # Retry if maze was somehow unsolvable (failsafe)
        attempts = 0
        while path is None and attempts < 10:
            sample_seed = int(rng.randint(0, 1_000_000_000))
            grid, start, goal = generate_maze(num_rooms=num_rooms, seed=sample_seed)
            path = solve_maze_bfs(grid, start, goal)
            attempts += 1

        if path is None:
            raise RuntimeError(f"Failed to generate solvable maze after 10 attempts at index {i}")

        # Input tensor
        inputs[i, 0] = grid # walls
        inputs[i, 1, start[0], start[1]] = 1.0 # start
        inputs[i, 2, goal[0], goal[1]] = 1.0 # goal

        # Target mask
        for r, c in path:
            targets[i, 0, r, c] = 1.0

    return inputs, targets


def print_maze_ascii(grid: np.ndarray, path: Optional[List[Tuple[int, int]]] = None) -> str:
    """
    Render a maze grid as an ASCII string.
    Uses:
      '#' for walls
      ' ' for open cells not on the shortest path
      '.' for cells on the shortest path
      'S' for start, 'G' for goal
    """
    h, w = grid.shape
    path_set = set(path) if path else set()

    lines = []
    for r in range(h):
        row = []
        for c in range(w):
            if grid[r, c] == 1.0:
                row.append('#')
            else:
                if (r, c) == (0, 0):
                    row.append('S')
                elif (r, c) == (h - 1, w - 1):
                    row.append('G')
                elif (r, c) in path_set:
                    row.append('.')
                else:
                    row.append(' ')
        lines.append(''.join(row))
    return '\n'.join(lines)


if __name__ == "__main__":
    in_arr, tgt_arr = generate_dataset(num_samples=5, grid_size=15, seed=42)
    print(f"Generated dataset shapes: inputs={in_arr.shape}, targets={tgt_arr.shape}")
    print("Sample 0 wall density:", np.mean(in_arr[0, 0]))
    print("Sample 0 path length:", np.sum(tgt_arr[0, 0]))

    print("\n" + "=" * 60)
    print("3 SAMPLE MAZES WITH BFS PATH OVERLAY")
    print("=" * 60)

    for i in range(3):
        grid = in_arr[i, 0]
        gt_mask = tgt_arr[i, 0]
        path = solve_maze_bfs(grid, (0, 0), (grid.shape[0] - 1, grid.shape[1] - 1))
        print(f"\n--- Maze {i + 1} (seed-derived sample {i}) ---")
        print(print_maze_ascii(grid, path))
        print(f"Grid size: {grid.shape[0]}x{grid.shape[1]}")
        print(f"Path length: {len(path) if path else 'N/A'}")
        print(f"Wall density: {np.mean(grid):.3f}")
