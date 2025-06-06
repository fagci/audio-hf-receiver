import AudioContextManager from './audio-context-manager.js'
import AudioInputManager from './audio-input-manager.js'

export default class AudioSystem {
    constructor() {
        this.audioContextManager = new AudioContextManager();
    }

    async init(sampleRate) {
        this.audioContextManager.init(sampleRate);
        this.inputManager = new AudioInputManager(this.audioContextManager.getContext());
        return await this.inputManager.getAudioDevices();
    }

    async setInputDevice(deviceId) {
        return await this.inputManager.setAudioInput(deviceId);
    }
}
