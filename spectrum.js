export default class EnhancedSpectrum {
    constructor(canvas, data, minDecibels, maxDecibels) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", {
            alpha: false,
            antialias: true // Включим сглаживание для более плавного вида
        });
        this.data = data;
        this.levels = new Uint8Array(data.length);
        this.minDecibels = minDecibels;
        this.maxDecibels = maxDecibels;
        this.decibelRange = maxDecibels - minDecibels;
        this.updated = false;
        this.bands = {};
        this.colors = {
            background: '#121212',
            spectrum: '#4fc3f7',
            bands: '#ff4081',
            grid: 'rgba(255,255,255,0.1)',
            scale: '#222222',
            scaleText: 'grey',
        };

        this.handleResize = () => this.onResize();
        window.addEventListener("resize", this.handleResize);
        this.onResize();
        this.setupGradient();
    }

    // Преобразование значения в децибелы
    valueToDecibels(value) {
        return this.minDecibels + (value / 255) * this.decibelRange;
    }

    // Преобразование децибел в значение
    decibelsToValue(db) {
        return ((db - this.minDecibels) / this.decibelRange) * 255;
    }

    drawDecibelScale() {
        const { ctx, canvas, minDecibels, maxDecibels } = this;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = this.colors.scale;
        ctx.fillStyle = this.colors.scaleText;
        ctx.font = '10px Arial';

        for (let db = minDecibels; db <= maxDecibels; db += 10) {
            const y = canvas.height - this.decibelsToValue(db);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();

            ctx.fillText(`${db.toFixed(0)} dB`, 40, y - 5);
        }
    }

    // Добавляем вертикальный градиент для визуализации
    setupGradient() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#4fc3f7');
        gradient.addColorStop(0.7, '#2196f3');
        gradient.addColorStop(1, '#0d47a1');
        this.colors.spectrum = gradient;
    }

    addBand(start, end, color = null) {
        const key = `${start},${end}`;
        this.bands[key] = {
            start,
            end,
            color: color || this.colors.bands
        };
    }

    removeBand(start, end) {
        delete this.bands[`${start},${end}`];
    }

    onResize() {
        const bb = this.canvas.getBoundingClientRect();
        this.canvas.width = bb.width;
        this.canvas.height = bb.height;
        this.setupGradient(); // Пересоздаем градиент при изменении размера
        this.updated = true;
    }

    update(data = null) {
        if (data) this.data = data;

        for (let i = 0; i < this.data.length; i++) {
            this.levels[i] = this.data[i];
        }
        this.updated = true;
    }

    render() {
        if (!this.updated) return;

        const { ctx, canvas } = this;
        const width = canvas.width;
        const height = canvas.height;
        const step = Math.max(1, width / this.levels.length);

        // Очистка с фоном
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, width, height);

        // Отрисовка сетки
        this.drawDecibelScale();

        // Отрисовка выделенных диапазонов
        this.drawBands();

        // Отрисовка спектра с оптимизированным рендерингом
        this.drawSpectrum(step, height);

        this.updated = false;
    }

    drawBands() {
        const { ctx, canvas } = this;
        Object.values(this.bands).forEach(band => {
            const { start, end, color } = band;

            ctx.fillStyle = color.replace(')', ',0.2)');
            ctx.fillRect(start, 0, end - start, canvas.height);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(start, 0);
            ctx.lineTo(start, canvas.height);
            ctx.moveTo(end, 0);
            ctx.lineTo(end, canvas.height);
            ctx.stroke();
        });
    }

    drawSpectrum(step, height) {
        const { ctx, levels } = this;
        const length = levels.length;

        ctx.lineWidth = 2;
        ctx.strokeStyle = this.colors.spectrum;
        ctx.beginPath();

        const stride = Math.max(1, Math.floor(length / (this.canvas.width * 2)));

        let firstPoint = true;
        for (let i = 0; i < length; i += stride) {
            const x = (i / length) * this.canvas.width;
            const db = this.valueToDecibels(levels[i]);
            const y = height - ((db - this.minDecibels) / this.decibelRange) * height;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Заполнение под кривой
        ctx.lineTo(this.canvas.width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const fillStyle = ctx.createLinearGradient(0, 0, 0, height);
        fillStyle.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
        fillStyle.addColorStop(1, 'rgba(13, 71, 161, 0.1)');

        ctx.fillStyle = fillStyle;
        ctx.fill();
    }

}
