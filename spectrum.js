function redomain(x, a, b, c, d) {
    if (x < a) x = a;
    if (x > b) x = b;
    return c + ((x - a) * (d - c)) / (b - a);
}

export default class Spectrum {
    constructor(cv, data, minValue = 0, maxValue = 65535) {
        this.cv = cv;
        this.ct = cv.getContext("2d", {
            alpha: false,
            antialias: false
        });
        this.data = data;
        this.levels = new Uint8Array(data.length);
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.updated = false;
        this.handleResize = () => this.onResize();
        window.addEventListener("resize", this.handleResize);
        this.onResize();
        console.log("Spectrum init");

        this.bws = [];
    }

    addBw(start, end) {
        this.bws[`${start},${end}`] = { start, end };
    }

    removeBw(start, end) {
        delete this.bws[`${start},${end}`];
    }

    onResize() {
        const bb = this.cv.getBoundingClientRect();
        this.cv.width = this.data.length;
        this.cv.height = bb.height;
    }

    update() {
        this.data.forEach((v, i) => {
            this.levels[i] = redomain(v, this.minValue, this.maxValue, 0, 255);
        });
        this.updated = true;
    }

    render() {
        if (!this.updated) return;
        this.ct.clearRect(0, 0, this.cv.width, this.cv.height);

        this.ct.strokeStyle = "red";
        this.ct.fillStyle = "rgba(255,0,0,0.25)";
        Object.values(this.bws).forEach(bw => {
            this.ct.beginPath();
            this.ct.moveTo(bw.start, 0);
            this.ct.lineTo(bw.start, this.cv.height);
            this.ct.stroke();

            this.ct.beginPath();
            this.ct.moveTo(bw.end, 0);
            this.ct.lineTo(bw.end, this.cv.height);
            this.ct.stroke();

            this.ct.fillRect(bw.start, 0, bw.end - bw.start, this.cv.height);
        });

        this.ct.strokeStyle = "yellow";
        this.ct.beginPath();
        for (let x = 0; x < this.cv.width; ++x) {
            this.ct.lineTo(
                x,
                this.cv.height - redomain(this.levels[x], 0, 255, 0, this.cv.height)
            );
        }
        this.ct.stroke();


        this.updated = false;
    }
}
