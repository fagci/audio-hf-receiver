// Базовый класс для визуализаций
class FrequencyVisualizer {
    constructor(canvas, minDecibels, maxDecibels, sampleRate = 48000, frequencyScale = 'log') {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.minDecibels = minDecibels;
        this.maxDecibels = maxDecibels;
        this.decibelRange = maxDecibels - minDecibels;

        this.sampleRate = sampleRate;
        this.frequencyScale = frequencyScale; // 'log' или 'linear'
        this.colors = {
            background: '#121212',
            grid: 'rgba(255,255,255,0.1)',
            scale: '#222222',
            scaleText: 'grey',
            bands: '#ff0000',
        };
    }

    remap(x, srcMin, srcMax, dstMin, dstMax) {
        if (srcMax === srcMin) return dstMin;
        x = Math.max(srcMin, Math.min(x, srcMax));
        return dstMin + ((x - srcMin) * (dstMax - dstMin)) / (srcMax - srcMin);
    }

    // Преобразование частоты в координату X
    frequencyToX(freq) {
        const maxFreq = this.sampleRate / 2;

        if (this.frequencyScale === 'log') {
            const logMin = Math.log10(20);
            const logMax = Math.log10(maxFreq);
            const logFreq = Math.log10(Math.max(20, freq));
            return this.remap(logFreq, logMin, logMax, 0, this.canvas.width);
        }
        return (freq / maxFreq) * this.canvas.width;
    }

    // Преобразование координаты X в частоту
    xToFrequency(x) {
        const maxFreq = this.sampleRate / 2;
        const normalizedX = x / this.canvas.width;

        if (this.frequencyScale === 'log') {
            const logMin = Math.log10(20);
            const logMax = Math.log10(maxFreq);
            return Math.pow(10, logMin + normalizedX * (logMax - logMin));
        }
        return normalizedX * maxFreq;
    }

    // Преобразование значения в децибелы
    valueToDecibels(value) {
        return this.minDecibels + (value / 255) * this.decibelRange;
    }

    // Преобразование децибел в значение
    decibelsToValue(db) {
        return ((db - this.minDecibels) / this.decibelRange) * 255;
    }

    // Общие методы для ресайза
    onResize() {
        const bb = this.canvas.getBoundingClientRect();
        this.canvas.width = bb.width;
        this.canvas.height = bb.height;
    }

    update(data = null) {
        if (data) this.data = data;

        for (let i = 0; i < this.data.length; i++) {
            this.levels[i] = this.data[i];
        }
        this.updated = true;
    }
}

// Класс Waterfall с наследованием
export class Waterfall extends FrequencyVisualizer {
    constructor(canvas, data, minDecibels, maxDecibels, sampleRate, frequencyScale, palette = ["#000000", "#0000FF", "#00FFFF", "#FFFF00", "#FFFFFF"]) {
        super(canvas, minDecibels, maxDecibels, sampleRate, frequencyScale);

        this.data = data;
        this.levels = new Uint8Array(data.length);
        this.imageData = null;
        this.updated = false;

        this.setPalette(palette);
        this.handleResize = () => this.onResize();
        window.addEventListener("resize", this.handleResize);
        this.onResize();
    }

    onResize() {
        const { canvas, ctx } = this;
        super.onResize();
        this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }


    render() {
        if (!this.updated || !this.imageData) return;

        const { canvas, levels, minDecibels, maxDecibels, colors } = this;
        const length = levels.length;

        const pixels = this.imageData.data;
        const width = canvas.width;
        const rowSize = width * 4;

        // Сдвигаем изображение вниз
        pixels.copyWithin(rowSize, 0, pixels.length - rowSize);

        // Заполняем новую строку с учетом частотной шкалы
        for (let x = 0; x < width; x++) {
            const freq = this.xToFrequency(x);
            const dataIndex = Math.floor((freq / (this.sampleRate / 2)) * length);
            const level = this.levels[Math.min(dataIndex, length - 1)];

            const [r, g, b] = this.colors[level];
            const idx = x * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = 255;
        }

        this.ctx.putImageData(this.imageData, 0, 0);
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


export class Spectrum extends FrequencyVisualizer {
    constructor(canvas, data, minDecibels, maxDecibels, sampleRate, frequencyScale) {
        super(canvas, minDecibels, maxDecibels, sampleRate, frequencyScale);

        this.data = data;
        this.levels = new Uint8Array(data.length);

        this.updated = false;
        this.bands = {};

        this.handleResize = () => this.onResize();
        window.addEventListener("resize", this.handleResize);
        this.onResize();
        this.setupGradient();
    }

    drawFrequencyGrid() {
        const { ctx, canvas, sampleRate } = this;
        const maxFreq = sampleRate / 2;

        ctx.strokeStyle = this.colors.grid;
        ctx.fillStyle = this.colors.scaleText;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Определяем подходящий шаг частот в зависимости от диапазона
        const freqStep = this.calculateOptimalFreqStep(maxFreq);

        // Рисуем вертикальные линии и подписи
        for (let freq = 0; freq <= maxFreq; freq += freqStep) {
            const x = this.frequencyToX(freq);

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();

            // Подписываем только значимые частоты
            if (freq >= 20) { // Не показываем подписи ниже 20 Гц
                let label;
                if (freq >= 1000) {
                    label = `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k`;
                } else {
                    label = `${freq}`;
                }

                ctx.fillText(label, x, canvas.height - 20);
            }
        }
    }

    calculateOptimalFreqStep(maxFreq) {
        const targetLines = 10; // Целевое количество линий

        if (this.frequencyScale === 'log') {
            // Для логарифмической шкалы используем октавы
            if (maxFreq <= 2000) return 100;
            if (maxFreq <= 5000) return 500;
            if (maxFreq <= 20000) return 1000;
            return 2000;
        } else {
            // Для линейной шкалы подбираем "круглый" шаг
            const power = Math.floor(Math.log10(maxFreq));
            const step = Math.pow(10, power) / (power > 1 ? 2 : 1);
            return Math.max(step, 10);
        }
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

    addBand(start, end, color = null, title = null) {
        const key = `${start},${end}`;
        this.bands[key] = {
            start,
            end,
            color: color || this.colors.bands,
            title
        };
    }

    removeBand(start, end) {
        delete this.bands[`${start},${end}`];
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
        this.drawFrequencyGrid();

        // Отрисовка выделенных диапазонов
        this.drawBands();

        // Отрисовка спектра с оптимизированным рендерингом
        this.drawSpectrum(step, height);

        this.updated = false;
    }

    drawBands() {
        const { ctx, canvas, minDecibels, decibelRange } = this;

        // Сначала рисуем полупрозрачные зоны
        Object.values(this.bands).forEach(band => {
            const startX = this.frequencyToX(band.start);
            const endX = this.frequencyToX(band.end);
            const bandWidth = endX - startX;

            // Градиент для зоны (более красивый эффект)
            const gradient = ctx.createLinearGradient(startX, 0, endX, 0);
            gradient.addColorStop(0, `${band.color}40`);
            gradient.addColorStop(0.5, `${band.color}20`);
            gradient.addColorStop(1, `${band.color}40`);

            const startY = band.title ? canvas.height - 15 : 0;

            ctx.fillStyle = band.title ? `${band.color}40` : gradient;
            ctx.fillRect(startX, startY, bandWidth, canvas.height - startY);

            // Границы диапазона с тенью
            ctx.strokeStyle = band.color;
            ctx.lineWidth = 1.5;

            // Левая граница
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX, canvas.height);
            ctx.stroke();

            // Правая граница
            ctx.beginPath();
            ctx.moveTo(endX, startY);
            ctx.lineTo(endX, canvas.height);
            ctx.stroke();

            // Подпись диапазона (центрированная)
            if (bandWidth > 40) { // Подписываем только широкие диапазоны
                ctx.fillStyle = band.color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                let centerX = startX + bandWidth / 2;
                if (centerX > canvas.width) {
                    centerX = startX + (canvas.width - startX) / 2;
                }
                const freqText = this.formatFrequencyRange(band.start, band.end);
                if (band.title) {
                    ctx.fillText(band.title, centerX, canvas.height - 12);
                } else {
                    ctx.fillText(freqText, centerX, 5);
                }
            }
        });
    }

    // Вспомогательный метод для форматирования подписи диапазона
    formatFrequencyRange(startFreq, endFreq) {
        if (endFreq >= 1000) {
            return `${(startFreq / 1000).toFixed(1)}k-${(endFreq / 1000).toFixed(1)}k`;
        }
        return `${startFreq}-${endFreq} Hz`;
    }

    drawSpectrum() {
        const { ctx, canvas, levels, minDecibels, maxDecibels } = this;
        const { width, height } = canvas;
        const length = levels.length;

        // Очищаем путь
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.colors.spectrum;

        // Рассчитываем первый точку
        const firstFreq = this.frequencyScale === 'log' ? 20 : 0; // Для логарифма начинаем с 20 Гц
        let x = this.frequencyToX(firstFreq);
        let y = height - this.remap(this.valueToDecibels(levels[0]), minDecibels, maxDecibels, 0, height);
        ctx.moveTo(x, y);

        // Оптимизация: рисуем только каждый N-ый пиксель
        const stride = Math.max(1, Math.floor(length / (width * 2)));

        // Рисуем спектр с учетом выбранной шкалы
        for (let i = stride; i < length; i += stride) {
            // Рассчитываем частоту для текущей точки
            const freq = (i / length) * (this.sampleRate / 2);

            // Пропускаем частоты ниже 20 Гц в логарифмическом режиме
            if (this.frequencyScale === 'log' && freq < 20) continue;

            x = this.frequencyToX(freq);
            y = height - this.remap(this.valueToDecibels(levels[i]), minDecibels, maxDecibels, 0, height);
            ctx.lineTo(x, y);
        }

        // Завершаем путь
        ctx.stroke();

        // Рисуем заполнение под кривой
        ctx.lineTo(x, height); // Последняя точка справа
        ctx.lineTo(this.frequencyToX(firstFreq), height); // Первая точка слева
        ctx.closePath();

        // Градиент для заполнения
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
        fillGradient.addColorStop(1, 'rgba(13, 71, 161, 0.1)');

        ctx.fillStyle = fillGradient;
        ctx.fill();
    }

}
