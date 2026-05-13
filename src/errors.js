export class AvaAgentError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class ConfigError extends AvaAgentError {}
export class ValidationError extends AvaAgentError {}
export class RpcError extends AvaAgentError {}
export class SwapError extends AvaAgentError {}
export class AuthorizationError extends AvaAgentError {}
