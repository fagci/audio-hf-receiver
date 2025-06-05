class FrequencyShiftProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.phase = 0;
    this.shiftFrequency = options.processorOptions.shiftFrequency;
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const phaseIncrement = (2 * Math.PI * this.shiftFrequency) / sampleRate;
    
    for (let channel = 0; channel < input.length; channel++) {
      for (let i = 0; i < input[channel].length; i++) {
        output[channel][i] = input[channel][i] * 2 * Math.cos(this.phase);
        this.phase += phaseIncrement;
      }
    }
    return true;
  }
}

registerProcessor('FrequencyShiftProcessor', FrequencyShiftProcessor);
