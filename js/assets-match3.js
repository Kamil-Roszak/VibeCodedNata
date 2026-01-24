const MATCH3_ASSETS = {
    'cola': 'assets/products/cola.png',
    'orange': 'assets/products/orange.png',
    'lemon': 'assets/products/lemon.png',
    'lime': 'assets/products/lime.png',
    'berry': 'assets/products/berry.png'
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
