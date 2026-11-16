const capitals = { France: 'Paris', Japan: 'Tokyo', Peru: 'Lima', Kenya: 'Nairobi', Italy: 'Rome' };

export default class Agent {
  constructor(options) {
    this.providerId = options.id;
    this.config = options.config ?? {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt) {
    const country = /Capital of ([A-Za-z]+)\?/.exec(prompt)[1];
    if (this.config.failOn === country) {
      return { error: 'simulated provider failure' };
    }
    const response = { output: this.config.answers?.[country] ?? capitals[country] };
    return this.config.cost === undefined ? response : { ...response, cost: this.config.cost };
  }
}
