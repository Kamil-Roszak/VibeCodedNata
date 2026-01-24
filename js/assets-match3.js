const MATCH3_ASSETS = {
    // Simple SVGs for distinct flavors
    'cola': `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCAxMDAiPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjcwIiByeD0iNSIgZmlsbD0iIzRBMjUxNSIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRTMwNjEzIi8+PHBhdGggZD0iTTE1IDUwIFEgMjUgNTUgMzUgNTAiIHN0cm9rZT0id2hpdGUiIGZpbGw9Im5vbmUiLz48cmVjdCB4PSIxNSIgeT0iMCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRTMwNjEzIi8+PC9zdmc+`, // Brown/Red
    'orange': `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCAxMDAiPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjcwIiByeD0iNSIgZmlsbD0iI0ZGQTUwMCIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjI1IiBjeT0iNTAiIHI9IjUiIGZpbGw9IiNGRkE1MDAiLz48cmVjdCB4PSIxNSIgeT0iMCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRkZBNTAwIi8+PC9zdmc+`, // Orange
    'lemon': `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCAxMDAiPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjcwIiByeD0iNSIgZmlsbD0iI0ZGRjIwMCIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRkZGRjAwIi8+PHBhdGggZD0iTTE1IDQ1IEwgMzUgNTUiIHN0cm9rZT0iIzMyQ0QzMiIvPjxyZWN0IHg9IjE1IiB5PSIwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IiM3N0ZGMDAiLz48L3N2Zz4=`, // Yellow
    'lime': `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCAxMDAiPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjcwIiByeD0iNSIgZmlsbD0iIzMyQ0QzMiIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjE1IiB5PSIwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9IiMzMkNEMzIiLz48L3N2Zz4=`, // Green
    'berry': `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCAxMDAiPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjcwIiByeD0iNSIgZmlsbD0iIzgwMDA4MCIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRkYwMEZGIi8+PHJlY3QgeD0iMTUiIHk9IjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzgwMDA4MCIvPjwvc3ZnPg==`, // Purple
};

class AssetLoader {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = Object.keys(MATCH3_ASSETS).length;
    }

    loadAll(callback) {
        if (this.totalCount === 0) {
            callback();
            return;
        }

        for (const [key, src] of Object.entries(MATCH3_ASSETS)) {
            const img = new Image();
            img.onload = () => {
                this.loadedCount++;
                if (this.loadedCount === this.totalCount) {
                    callback();
                }
            };
            img.onerror = (e) => {
                console.error(`AssetLoader: Failed to load ${key}`);
                // Continue anyway to avoid hanging
                this.loadedCount++;
                if (this.loadedCount === this.totalCount) {
                    callback();
                }
            };
            img.src = src;
            this.images[key] = img;
        }
    }

    get(key) {
        return this.images[key];
    }
}

window.AssetLoader = AssetLoader;
window.MATCH3_ASSETS = MATCH3_ASSETS;
