export default class AudioContextManager {
    audioContext = null;
    preferredSampleRate = null;

    // Инициализация контекста с выбранной sample rate
    init(preferredSampleRate) {
        if (this.audioContext) {
            this.audioContext.close(); // Закрыть старый контекст, если был
        }

        this.preferredSampleRate = preferredSampleRate || null;

        const options = {};
        if (this.preferredSampleRate) {
            options.sampleRate = this.preferredSampleRate;
        }

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)(options);

        // Проверяем реальный sample rate (браузер может проигнорировать запрос)
        console.log("Actual sample rate:", this.audioContext.sampleRate);

        return this.audioContext;
    }

    getContext() {
        return this.audioContext;
    }
}
