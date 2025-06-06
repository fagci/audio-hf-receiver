function clampAndRemap(x, srcMin, srcMax, dstMin, dstMax) {
    if (srcMax === srcMin) return dstMin;
    x = Math.max(srcMin, Math.min(x, srcMax));
    return dstMin + ((x - srcMin) * (dstMax - dstMin)) / (srcMax - srcMin);
}

export default class Waterfall {
    constructor(
        cv,
        data,
        minValue = 0,
        maxValue = 65535,
        palette = ["#000000", "#000050", "#FF00FF", "#FFFF50", "#FFFFFF"]
    ) {
        this.cv = cv;
        this.ct = cv.getContext("2d", {
            alpha: false,
            antialias: false,
            willReadFrequently: true
        });
        this.imageData = null;
        this.data = data;
        this.levels = new Uint8Array(data.length);
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.updated = false;
        this.setPalette(palette);
        this.handleResize = () => this.onResize();
        window.addEventListener("resize", this.handleResize);
        this.onResize();
        console.log("Waterfall init");
    }

    onResize() {
        const bb = this.cv.getBoundingClientRect();
        this.cv.width = this.data.length;
        this.cv.height = bb.height;
        this.imageData = this.ct.getImageData(0, 0, this.cv.width, this.cv.height);
    }

    update() {
        const { data, minValue, maxValue, levels } = this;
        for (let i = 0; i < data.length; i++) {
            levels[i] = clampAndRemap(data[i], minValue, maxValue, 0, 255);
        }
        this.updated = true;
    }

    render() {
        if (!this.updated || !this.imageData) return;

        const pixels = this.imageData.data;
        const width = this.cv.width;
        const height = this.cv.height;
        const rowSize = width * 4;

        pixels.copyWithin(rowSize, 0, pixels.length - rowSize);

        for (let x = 0; x < width; x++) {
            const [r, g, b] = this.colors[this.levels[x]];
            const idx = x * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = 255; // альфа
        }

        this.ct.putImageData(this.imageData, 0, 0);
        this.updated = false;
    }

    setPalette(palette) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, 256, 0);
        palette.forEach((color, i) =>
            gradient.addColorStop(i / (palette.length - 1), color)
        );

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 1);

        this.colors = [];
        const imageData = ctx.getImageData(0, 0, 256, 1).data;
        for (let i = 0; i < 256; i++) {
            this.colors[i] = [
                imageData[i * 4],
                imageData[i * 4 + 1],
                imageData[i * 4 + 2]
            ];
        }
    }

    destroy() {
        window.removeEventListener("resize", this.handleResize);
    }
}
