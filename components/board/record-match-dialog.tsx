'use client'

import * as React from 'react'
import { Check, Swords, Crown, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { authClient } from '@/lib/auth-client'

export function RecordMatchDialog({ groupId }: { groupId: string }) {
  const { games, players, addMatch } = useStore()
  const { data: session } = authClient.useSession()
  const groupGames = games.filter((g) => g.groupId === groupId)
  const groupPlayers = players.filter((p) => p.groupId === groupId)

  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [gameId, setGameId] = React.useState('')
  const [participants, setParticipants] = React.useState<string[]>([])
  const [winnerId, setWinnerId] = React.useState('')
  const [duration, setDuration] = React.useState('')
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10))

  function reset() {
    setGameId('')
    setParticipants([])
    setWinnerId('')
    setDuration('')
    setDate(new Date().toISOString().slice(0, 10))
  }

  function toggleParticipant(id: string) {
    setParticipants((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      if (!next.includes(winnerId)) setWinnerId('')
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return toast.error('Iniciá sesión para registrar partidas')
    if (!gameId) return toast.error('Elegí un juego')
    if (participants.length < 2) return toast.error('Elegí al menos 2 participantes')
    if (!winnerId) return toast.error('Marcá quién ganó')
    if (!duration || Number(duration) <= 0) return toast.error('Cargá la duración')

    setIsSubmitting(true)
    try {
      const ok = await addMatch({
        groupId,
        gameId,
        playerIds: participants,
        winnerId,
        durationMinutes: Number(duration),
        playedAt: date,
      })
      if (ok) {
        toast.success('Partida registrada')
        setOpen(false)
        reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const winnerCandidates = groupPlayers.filter((p) => participants.includes(p.id))
  const noGames = groupGames.length === 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="secondary" disabled={noGames}>
            <Swords data-icon="inline-start" />
            Registrar partida
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Registrar partida</DialogTitle>
          <DialogDescription>Anotá quién jugó, quién ganó y cuánto duró.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Juego</FieldLabel>
              <Select value={gameId} onValueChange={(value) => setGameId(value ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un juego" />
                </SelectTrigger>
                <SelectContent>
                  {groupGames.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Participantes</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {groupPlayers.map((p) => {
                  const active = participants.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleParticipant(p.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary/50',
                      )}
                    >
                      {active && <Check className="size-3.5" />}
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel>
                <Crown className="size-4 text-accent" />
                Ganador
              </FieldLabel>
              <Select value={winnerId} onValueChange={(value) => setWinnerId(value ?? '')} disabled={winnerCandidates.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="¿Quién ganó?" />
                </SelectTrigger>
                <SelectContent>
                  {winnerCandidates.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="match-duration">
                  <Clock className="size-4" />
                  Duración (min)
                </FieldLabel>
                <Input
                  id="match-duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="match-date">Fecha</FieldLabel>
                <Input
                  id="match-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar partida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
