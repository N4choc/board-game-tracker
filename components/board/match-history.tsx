'use client'

import { Crown, Clock, Trash2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { formatDuration, gameName, playerName } from '@/lib/stats'
import { useStore } from '@/lib/store'
import type { Match } from '@/lib/types'

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MatchHistory({ matches }: { matches: Match[] }) {
  const { games, players, deleteMatch } = useStore()

  if (matches.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed border-border bg-card/50 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>Sin partidas todavía</EmptyTitle>
          <EmptyDescription>Registrá la primera partida para empezar a llevar la cuenta.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const sorted = [...matches].sort((a, b) => b.playedAt.localeCompare(a.playedAt))

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((m) => (
        <Card key={m.id} className="flex flex-row items-center gap-4 p-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-foreground">
                {gameName(games, m.gameId)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <Crown className="size-3 text-accent" />
                {playerName(players, m.winnerId)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(m.playedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDuration(m.durationMinutes)}
              </span>
              <span className="truncate">
                {m.playerIds.map((id) => playerName(players, id)).join(', ')}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar partida"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              const ok = await deleteMatch(m.id)
              if (ok) {
                toast.success('Partida eliminada')
              }
            }}
          >
            <Trash2 />
          </Button>
        </Card>
      ))}
    </div>
  )
}
