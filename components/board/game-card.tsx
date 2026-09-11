'use client'

import { MoreVertical, Trash2, Clock, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/lib/stats'
import { useStore } from '@/lib/store'
import type { Game } from '@/lib/types'

export function GameCard({ game }: { game: Game }) {
  const { matches, deleteGame } = useStore()
  const played = matches.filter((m) => m.gameId === game.id).length

  return (
    <Card className="flex flex-col overflow-hidden border-border/80 p-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.photoUrl || '/placeholder.svg?height=200&width=320&query=board%20game%20box'}
          alt={`Portada de ${game.name}`}
          className="size-full object-cover"
        />
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="secondary" size="icon-sm" aria-label="Opciones del juego">
                  <MoreVertical />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    const ok = await deleteGame(game.id)
                    if (ok) {
                      toast.success(`"${game.name}" eliminado`)
                    }
                  }}
                >
                  <Trash2 />
                  Eliminar juego
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-serif text-base font-semibold leading-tight text-foreground text-balance">
            {game.name}
          </h4>
          {game.category && (
            <Badge variant="outline" className="shrink-0">
              {game.category}
            </Badge>
          )}
        </div>
        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Swords className="size-3.5" />
            {played} {played === 1 ? 'partida' : 'partidas'}
          </span>
          {game.suggestedMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />~{formatDuration(game.suggestedMinutes)}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
