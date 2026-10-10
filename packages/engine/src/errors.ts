/** Thrown by apply() for an action the rules reject. The server answers 400. */
export class IllegalActionError extends Error {
  override name = 'IllegalActionError'
}

/** Thrown by the engine when a seat acts out of turn. The server answers 409. */
export class NotYourTurnError extends Error {
  override name = 'NotYourTurnError'
}
