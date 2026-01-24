class Match3Logic {
    constructor(rows, cols, types) {
        this.rows = rows;
        this.cols = cols;
        this.types = types; // Number of available colors/types (0 to types-1)
        this.grid = [];
        this.score = 0;
        this.matches = [];

        // Initialize grid
        this.reset();
    }

    reset() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                // Determine a valid type that doesn't create a match initially
                let type;
                do {
                    type = Math.floor(Math.random() * this.types);
                } while (this.createsMatch(r, c, type, row));
                row.push({ type: type, empty: false });
            }
            this.grid.push(row);
        }
    }

    // Check if placing 'type' at r,c creates a match with existing grid
    createsMatch(r, c, type, currentRow) {
        // Check horizontal (left)
        if (c >= 2) {
            if (currentRow[c-1].type === type && currentRow[c-2].type === type) return true;
        }
        // Check vertical (up)
        if (r >= 2) {
            if (this.grid[r-1][c].type === type && this.grid[r-2][c].type === type) return true;
        }
        return false;
    }

    isValid(r, c) {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    // Try to swap two cells. Returns true if valid swap (results in match), else reverts and returns false.
    // In many games, you can only swap adjacent.
    swap(r1, c1, r2, c2) {
        if (!this.isValid(r1, c1) || !this.isValid(r2, c2)) return false;

        // Check adjacency
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);
        if (dr + dc !== 1) return false; // Must be adjacent

        // Perform Swap
        let temp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = temp;

        // Check if matches exist
        const matches = this.findMatches();
        if (matches.length > 0) {
            return true; // Valid swap
        } else {
            // Revert
            temp = this.grid[r1][c1];
            this.grid[r1][c1] = this.grid[r2][c2];
            this.grid[r2][c2] = temp;
            return false;
        }
    }

    // Find all matches in the current grid
    findMatches() {
        const matches = new Set(); // Store "r,c" strings

        // Horizontal
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                const t = this.grid[r][c].type;
                if (t === -1) continue; // Empty
                if (this.grid[r][c+1].type === t && this.grid[r][c+2].type === t) {
                    matches.add(`${r},${c}`);
                    matches.add(`${r},${c+1}`);
                    matches.add(`${r},${c+2}`);
                    // Check for more
                    let k = c + 3;
                    while (k < this.cols && this.grid[r][k].type === t) {
                        matches.add(`${r},${k}`);
                        k++;
                    }
                }
            }
        }

        // Vertical
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                const t = this.grid[r][c].type;
                if (t === -1) continue;
                if (this.grid[r+1][c].type === t && this.grid[r+2][c].type === t) {
                    matches.add(`${r},${c}`);
                    matches.add(`${r+1},${c}`);
                    matches.add(`${r+2},${c}`);
                    let k = r + 3;
                    while (k < this.rows && this.grid[k][c].type === t) {
                        matches.add(`${k},${c}`);
                        k++;
                    }
                }
            }
        }

        return Array.from(matches).map(s => {
            const [r, c] = s.split(',').map(Number);
            return { r, c };
        });
    }

    // Remove matches and mark cells as empty
    removeMatches(matches) {
        for (const m of matches) {
            this.grid[m.r][m.c].type = -1; // -1 means empty
            this.grid[m.r][m.c].empty = true;
        }
        // Score calculation: 10 per tile, bonus for >3
        this.score += matches.length * 10;
    }

    // Apply gravity: move tiles down to fill empty spaces
    applyGravity() {
        let moves = []; // Track movements for animation: {fromR, fromC, toR, toC}

        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c].type !== -1) {
                    if (writeRow !== r) {
                        // Move tile down
                        this.grid[writeRow][c] = this.grid[r][c];
                        this.grid[r][c] = { type: -1, empty: true };
                        moves.push({ c: c, fromR: r, toR: writeRow });
                    }
                    writeRow--;
                }
            }
        }
        return moves;
    }

    // Refill empty cells at the top
    refill() {
        let newTiles = [];
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c].type === -1) {
                    const newType = Math.floor(Math.random() * this.types);
                    this.grid[r][c] = { type: newType, empty: false };
                    newTiles.push({ r, c, type: newType });
                }
            }
        }
        return newTiles;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Match3Logic;
} else {
    window.Match3Logic = Match3Logic;
}
