'use client'

import * as React from 'react'
import type { Group, Player, Game, Match } from '@/lib/types'

/*
 * In-memory data layer for the board game tracker.
 *
 * NOTE: This provider keeps all state in memory for the session. It is written
 * as a single access layer (the `useStore` hook) so it can later be swapped for
 * a real database (Neon/Supabase) without touching the UI components — each
 * mutation below maps 1:1 to an API route / SQL statement.
 */

import { toast } from 'sonner'

type State = {
  groups: Group[]
  players: Player[]
  games: Game[]
  matches: Match[]
}

const uid = () => Math.random().toString(36).slice(2, 10)

const emptyState: State = {
  groups: [],
  players: [],
  games: [],
  matches: [],
}

export type PlayerInput = string | { name: string; userId?: string | null }

type StoreValue = State & {
  addGroup: (name: string, players: PlayerInput[]) => Promise<string | null>
  deleteGroup: (groupId: string) => Promise<boolean>
  leaveGroup: (groupId: string) => Promise<boolean>
  addPlayer: (groupId: string, name: string, userId?: string | null) => Promise<boolean>
  removePlayer: (playerId: string) => void
  addGame: (game: Omit<Game, 'id'>) => Promise<boolean>
  deleteGame: (gameId: string) => Promise<boolean>
  addMatch: (match: Omit<Match, 'id'>) => Promise<boolean>
  deleteMatch: (matchId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

const StoreContext = React.createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>(() => emptyState)
  const hydrated = React.useRef(false)

  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/board')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[Store] Error al obtener datos:', data.error || res.statusText)
        return
      }
      const data = await res.json()
      if (Array.isArray(data.groups)) {
        setState({
          groups: (data.groups ?? []).map((g: any) => ({
            id: g.id,
            name: g.name,
            createdAt: g.createdAt ?? g.created_at,
            createdBy: g.createdBy ?? g.created_by ?? null,
            inviteCode: g.inviteCode ?? g.invite_code ?? null,
          })),
          players: (data.players ?? []).map((p: any) => ({
            id: p.id,
            groupId:
              data.groupPlayers?.find((x: any) => (x.playerId ?? x.player_id) === p.id)?.groupId ??
              data.groupPlayers?.find((x: any) => (x.playerId ?? x.player_id) === p.id)?.group_id ??
              '',
            name: p.name,
            userId: p.userId ?? p.user_id ?? null,
          })),
          games: (data.games ?? []).map((g: any) => ({
            id: g.id,
            groupId:
              data.groupGames?.find((x: any) => (x.gameId ?? x.game_id) === g.id)?.groupId ??
              data.groupGames?.find((x: any) => (x.gameId ?? x.game_id) === g.id)?.group_id ??
              '',
            name: g.name,
            photoUrl: g.imageUrl ?? g.image_url,
            category: g.description,
          })),
          matches: (data.matches ?? []).map((m: any) => ({
            id: m.id,
            groupId: m.groupId ?? m.group_id,
            gameId: m.gameId ?? m.game_id,
            winnerId: m.winnerId ?? m.winner_id,
            durationMinutes: m.durationMinutes ?? m.duration_minutes,
            playedAt: m.playedAt ?? m.played_at,
            playerIds: (data.matchPlayers ?? [])
              .filter((x: any) => (x.matchId ?? x.match_id) === m.id)
              .map((x: any) => x.playerId ?? x.player_id),
          })),
        })
      }
    } catch (err: any) {
      console.error('[Store] Error de conexión:', err)
    }
  }, [])

  React.useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    fetchData()
  }, [fetchData])

  const persist = React.useCallback(
    async (payload: unknown): Promise<boolean> => {
      try {
        const res = await fetch('/api/board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || 'Error al guardar en el servidor')
          await fetchData()
          return false
        }
        return true
      } catch (err: any) {
        toast.error(err.message || 'Error de conexión con el servidor')
        await fetchData()
        return false
      }
    },
    [fetchData]
  )

  const remove = React.useCallback(
    async (type: 'group' | 'game' | 'match', id: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/board', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || 'Error al eliminar')
          await fetchData()
          return false
        }
        return true
      } catch (err: any) {
        toast.error(err.message || 'Error de conexión con el servidor')
        await fetchData()
        return false
      }
    },
    [fetchData]
  )

  const value = React.useMemo<StoreValue>(() => {
    return {
      ...state,
      refresh: fetchData,
      async addGroup(name, rawPlayers) {
        const id = 'g-' + uid()
        const inviteCode = Math.random().toString(36).slice(2, 10)
        const group: Group = {
          id,
          name: name.trim(),
          createdAt: new Date().toISOString().slice(0, 10),
          inviteCode,
        }

        const players: Player[] = []
        for (const item of rawPlayers) {
          if (typeof item === 'string') {
            const trimmed = item.trim()
            if (trimmed) {
              players.push({ id: 'p-' + uid(), groupId: id, name: trimmed, userId: null })
            }
          } else {
            const trimmed = item.name.trim()
            if (trimmed) {
              players.push({ id: 'p-' + uid(), groupId: id, name: trimmed, userId: item.userId || null })
            }
          }
        }

        setState((s) => ({ ...s, groups: [...s.groups, group], players: [...s.players, ...players] }))
        const ok = await persist({
          type: 'group',
          id,
          group: { id, name: group.name, color: 'amber', description: null, inviteCode },
          players: players.map((p) => ({
            id: p.id,
            name: p.name,
            initials: p.name.slice(0, 2).toUpperCase(),
            color: 'amber',
            userId: p.userId,
          })),
        })
        return ok ? id : null
      },
      async deleteGroup(groupId) {
        try {
          const res = await fetch('/api/board', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'group', id: groupId }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            toast.error(data.error || 'No se pudo eliminar el grupo')
            return false
          }
          setState((s) => ({
            groups: s.groups.filter((g) => g.id !== groupId),
            players: s.players.filter((p) => p.groupId !== groupId),
            games: s.games.filter((g) => g.groupId !== groupId),
            matches: s.matches.filter((m) => m.groupId !== groupId),
          }))
          toast.success('Grupo eliminado correctamente')
          return true
        } catch (err: any) {
          toast.error(err.message || 'Error al eliminar el grupo')
          return false
        }
      },
      async leaveGroup(groupId) {
        try {
          const res = await fetch('/api/board', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'leave-group', id: groupId }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            toast.error(data.error || 'No se pudo salir del grupo')
            return false
          }
          await fetchData()
          toast.success('Saliste del grupo exitosamente')
          return true
        } catch (err: any) {
          toast.error(err.message || 'Error al salir del grupo')
          return false
        }
      },
      async addPlayer(groupId, name, userId) {
        const player: Player = {
          id: 'p-' + uid(),
          groupId,
          name: name.trim(),
          userId: userId || null,
        }
        setState((s) => ({ ...s, players: [...s.players, player] }))
        const ok = await persist({
          type: 'player',
          id: player.id,
          groupId,
          player: {
            id: player.id,
            name: player.name,
            initials: player.name.slice(0, 2).toUpperCase(),
            color: 'amber',
            userId: player.userId,
          },
        })
        return ok
      },
      removePlayer(playerId) {
        setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== playerId) }))
      },
      async addGame(game) {
        const full: Game = { ...game, id: 'game-' + uid() }
        setState((s) => ({ ...s, games: [...s.games, full] }))
        const ok = await persist({
          type: 'game',
          id: full.id,
          groupId: full.groupId,
          game: {
            id: full.id,
            name: full.name,
            description: full.category ?? null,
            imageUrl: full.photoUrl ?? null,
            color: 'amber',
          },
        })
        return ok
      },
      async deleteGame(gameId) {
        setState((s) => ({
          ...s,
          games: s.games.filter((g) => g.id !== gameId),
          matches: s.matches.filter((m) => m.gameId !== gameId),
        }))
        return await remove('game', gameId)
      },
      async addMatch(match) {
        const full: Match = { ...match, id: 'm-' + uid() }
        setState((s) => ({ ...s, matches: [...s.matches, full] }))
        const ok = await persist({
          type: 'match',
          id: full.id,
          match: {
            id: full.id,
            groupId: full.groupId,
            gameId: full.gameId,
            winnerId: full.winnerId,
            durationMinutes: full.durationMinutes,
            playedAt: full.playedAt,
          },
          playerIds: full.playerIds,
        })
        return ok
      },
      async deleteMatch(matchId) {
        setState((s) => ({ ...s, matches: s.matches.filter((m) => m.id !== matchId) }))
        return await remove('match', matchId)
      },
    }
  }, [state, persist, remove, fetchData])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

