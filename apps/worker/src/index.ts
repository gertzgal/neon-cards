import { createApp } from './app'
import { devGames, games } from './games'
import { RoomObject } from './room-object'

export type { Env } from './env'
export type { Health } from './app'

export { RoomObject }

export default createApp(games, devGames)
