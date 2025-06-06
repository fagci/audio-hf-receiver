export default class AudioInputManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // Получаем список доступных аудиоустройств
    async getAudioDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === "audioinput");
    }

    // Захватываем аудио с выбранного устройства
    async setAudioInput(deviceId) {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }

        const supported = navigator.mediaDevices.getSupportedConstraints();

        const constraints = {
            audio: {
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                    sampleRate: this.audioContext.sampleRate,
                    channelCount: 1,
                    ...(supported.voiceIsolation && { voiceIsolation: false }),
                    ...(deviceId && { deviceId: { exact: deviceId } }),
                },
                video: false,
        };

        this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }

        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.audioStream);
        return this.mediaStreamSource;
    }

    stop() {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }
    }
}
