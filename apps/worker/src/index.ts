import { createApp } from './app'
import { devGames, games } from './games'

export type { Env } from './env'
export type { Health } from './app'

export default createApp(games, devGames)
