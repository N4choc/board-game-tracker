'use client'

import * as React from 'react'
import { Plus, Trash2, UserPlus } from 'lucide-react'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useStore } from '@/lib/store'
import { authClient } from '@/lib/auth-client'

import { useFriends } from '@/lib/use-friends'
import { Badge } from '@/components/ui/badge'
import { PlayerAvatar } from '@/components/board/player-avatar'

type FormPlayer = {
  name: string
  userId?: string | null
}

export function CreateGroupDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const { addGroup } = useStore()
  const { data: session } = authClient.useSession()
  const { friends } = useFriends()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [players, setPlayers] = React.useState<FormPlayer[]>([
    { name: '', userId: null },
    { name: '', userId: null },
    { name: '', userId: null },
  ])

  React.useEffect(() => {
    if (session?.user?.name) {
      setPlayers((prev) => [
        { name: session.user.name, userId: session.user.id },
        prev[1]?.name ? prev[1] : { name: '', userId: null },
        prev[2]?.name ? prev[2] : { name: '', userId: null },
      ])
    }
  }, [session?.user?.name, session?.user?.id, open])

  function reset() {
    setName('')
    setPlayers([
      { name: session?.user?.name || '', userId: session?.user?.id || null },
      { name: '', userId: null },
      { name: '', userId: null },
    ])
  }

  function addFriendToPlayers(friend: { id: string; name: string }) {
    setPlayers((prev) => {
      // Look for first empty slot
      const emptyIdx = prev.findIndex((p) => !p.name.trim())
      if (emptyIdx !== -1) {
        return prev.map((p, idx) =>
          idx === emptyIdx ? { name: friend.name, userId: friend.id } : p
        )
      }
      return [...prev, { name: friend.name, userId: friend.id }]
    })
  }

  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Friends not currently in form
  const availableFriends = friends.filter(
    (f) =>
      !players.some(
        (p) => p.userId === f.id || p.name.toLowerCase() === f.name.toLowerCase()
      )
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) {
      toast.error('Iniciá sesión para crear un grupo')
      return
    }
    const cleanName = name.trim()
    const cleanPlayers = players.filter((p) => p.name.trim())
    if (!cleanName) {
      toast.error('Ponele un nombre al grupo')
      return
    }
    if (cleanPlayers.length < 2) {
      toast.error('Agregá al menos 2 jugadores')
      return
    }

    setIsSubmitting(true)
    try {
      const id = await addGroup(cleanName, cleanPlayers)
      if (id) {
        toast.success(`Grupo "${cleanName}" creado`)
        setOpen(false)
        reset()
        onCreated?.(id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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
          <Button>
            <Plus data-icon="inline-start" />
            Nuevo grupo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Crear un grupo</DialogTitle>
          <DialogDescription>
            Un grupo reúne a los jugadores que comparten mesa. Ej: “Jelium” con Nacho, Gonzo y Renzo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="group-name">Nombre del grupo</FieldLabel>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jelium"
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel>Jugadores</FieldLabel>
              <div className="flex flex-col gap-2">
                {players.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={p.name}
                      onChange={(e) =>
                        setPlayers((prev) =>
                          prev.map((v, idx) =>
                            idx === i ? { ...v, name: e.target.value, userId: null } : v
                          )
                        )
                      }
                      placeholder={`Jugador ${i + 1}${i === 0 ? ' (vos)' : ''}`}
                    />
                    {players.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar jugador"
                        onClick={() => setPlayers((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {availableFriends.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Sumar rápido de tus amigos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableFriends.map((f) => (
                      <Badge
                        key={f.id}
                        variant="outline"
                        className="cursor-pointer gap-1 hover:bg-primary/10 hover:text-primary transition-colors py-1 px-2 text-xs"
                        onClick={() => addFriendToPlayers(f)}
                      >
                        <PlayerAvatar id={f.id} name={f.name} className="size-3.5" />
                        <span>+ {f.name}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={() => setPlayers((prev) => [...prev, { name: '', userId: null }])}
              >
                <UserPlus data-icon="inline-start" />
                Agregar jugador
              </Button>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear grupo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
