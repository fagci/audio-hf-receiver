class FrequencyShiftProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.shiftFrequency = options.processorOptions.shiftFrequency || 0;
    this.sampleRate = 44100;
    this.t = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channel = 0; channel < input.length; ++channel) {
      const inputData = input[channel];
      const outputData = output[channel];

      for (let i = 0; i < inputData.length; ++i) {
        // Гетеродинирование: умножение на cos(wt)
        const modulation = Math.cos(2 * Math.PI * this.shiftFrequency * this.t);
        outputData[i] = inputData[i] * modulation;
        this.t += 1 / this.sampleRate;
      }
    }

    return true;
  }
}

registerProcessor('FrequencyShiftProcessor', FrequencyShiftProcessor);
