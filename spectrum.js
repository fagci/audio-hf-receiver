export default class EnhancedSpectrum {
    constructor(canvas, data, minDecibels, maxDecibels, sampleRate) {
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

        this.sampleRate = sampleRate;
        this.frequencyScale = 'linear'; // 'log' или 'linear'

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

    frequencyToX(freq) {
        const { canvas, sampleRate, frequencyScale } = this;
        const maxFreq = sampleRate / 2;

        if (frequencyScale === 'log') {
            // Логарифмическая шкала для лучшего отображения низких частот
            const logMin = Math.log10(20); // 20 Гц - минимальная слышимая частота
            const logMax = Math.log10(maxFreq);
            const logFreq = Math.log10(Math.max(20, freq));
            return ((logFreq - logMin) / (logMax - logMin)) * canvas.width;
        } else {
            // Линейная шкала
            return (freq / maxFreq) * canvas.width;
        }
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

            ctx.fillStyle = gradient;
            ctx.fillRect(startX, 0, bandWidth, canvas.height);

            // Границы диапазона с тенью
            ctx.strokeStyle = band.color;
            ctx.lineWidth = 1.5;

            // Левая граница
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX, canvas.height);
            ctx.stroke();

            // Правая граница
            ctx.beginPath();
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX, canvas.height);
            ctx.stroke();

            // Подпись диапазона (центрированная)
            if (bandWidth > 40) { // Подписываем только широкие диапазоны
                ctx.fillStyle = band.color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const centerX = startX + bandWidth / 2;
                const freqText = this.formatFrequencyRange(band.start, band.end);
                ctx.fillText(freqText, centerX, 5);
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
        const { ctx, canvas, levels, minDecibels, decibelRange } = this;
        const height = canvas.height;
        const length = levels.length;

        // Очищаем путь
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.colors.spectrum;

        // Рассчитываем первый точку
        const firstFreq = this.frequencyScale === 'log' ? 20 : 0; // Для логарифма начинаем с 20 Гц
        let x = this.frequencyToX(firstFreq);
        let y = height - (this.valueToDecibels(levels[0]) - minDecibels) / decibelRange * height;
        ctx.moveTo(x, y);

        // Оптимизация: рисуем только каждый N-ый пиксель
        const stride = Math.max(1, Math.floor(length / (canvas.width * 2)));

        // Рисуем спектр с учетом выбранной шкалы
        for (let i = stride; i < length; i += stride) {
            // Рассчитываем частоту для текущей точки
            const freq = (i / length) * (this.sampleRate / 2);

            // Пропускаем частоты ниже 20 Гц в логарифмическом режиме
            if (this.frequencyScale === 'log' && freq < 20) continue;

            x = this.frequencyToX(freq);
            y = height - (this.valueToDecibels(levels[i]) - minDecibels) / decibelRange * height;
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
