'use client'

import * as React from 'react'
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  ScrollText,
  UserPlus,
  Share2,
  Trash2,
  Copy,
  Check,
  Users,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PlayerAvatar } from '@/components/board/player-avatar'
import { GameCard } from '@/components/board/game-card'
import { Leaderboard } from '@/components/board/leaderboard'
import { MatchHistory } from '@/components/board/match-history'
import { AddGameDialog } from '@/components/board/add-game-dialog'
import { RecordMatchDialog } from '@/components/board/record-match-dialog'
import { DeleteGroupDialog } from '@/components/board/delete-group-dialog'
import { LeaveGroupDialog } from '@/components/board/leave-group-dialog'
import { useStore } from '@/lib/store'
import { computePlayerStats } from '@/lib/stats'
import { useFriends } from '@/lib/use-friends'
import { authClient } from '@/lib/auth-client'

function AddPlayerDialog({ groupId }: { groupId: string }) {
  const { addPlayer, players } = useStore()
  const { friends } = useFriends()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const groupPlayers = players.filter((p) => p.groupId === groupId)
  // Friends not yet in this group
  const availableFriends = friends.filter(
    (f) =>
      !groupPlayers.some(
        (p) => p.userId === f.id || p.name.toLowerCase() === f.name.toLowerCase()
      )
  )

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Escribí un nombre')
    const ok = await addPlayer(groupId, name.trim())
    if (ok) {
      toast.success(`${name.trim()} se sumó al grupo`)
      setName('')
      setOpen(false)
    }
  }

  async function handleAddFriend(friend: { id: string; name: string }) {
    const ok = await addPlayer(groupId, friend.name, friend.id)
    if (ok) {
      toast.success(`${friend.name} se sumó al grupo`)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserPlus data-icon="inline-start" className="size-4" />
            Sumar jugador
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Sumar jugador a la mesa</DialogTitle>
          <DialogDescription>
            Sumá a uno de tus amigos registrados o agregá un jugador invitado.
          </DialogDescription>
        </DialogHeader>

        {availableFriends.length > 0 ? (
          <Tabs defaultValue="friends" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="friends" className="flex-1">
                Tus amigos ({availableFriends.length})
              </TabsTrigger>
              <TabsTrigger value="guest" className="flex-1">
                Invitado / Otro
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="pt-3">
              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                {availableFriends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar id={f.id} name={f.name} className="size-8" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{f.name}</span>
                        {f.username && (
                          <span className="text-xs text-muted-foreground mt-0.5">@{f.username}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddFriend(f)}
                    >
                      Sumar
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="guest" className="pt-3">
              <form onSubmit={submitGuest}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-player">Nombre del jugador invitado</FieldLabel>
                    <Input
                      id="new-player"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Renzo"
                      autoFocus
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter className="mt-5">
                  <Button type="submit">Sumar invitado</Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={submitGuest} className="mt-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-player">Nombre del jugador</FieldLabel>
                <Input
                  id="new-player"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Renzo"
                  autoFocus
                />
              </Field>
            </FieldGroup>
            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Podés agregar amigos desde la pestaña &quot;Amigos&quot; para sumarlos con un solo clic.
              </p>
            )}
            <DialogFooter className="mt-5">
              <Button type="submit">Agregar al grupo</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function InviteGroupDialog({
  groupName,
  inviteCode,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  groupName: string
  inviteCode?: string | null
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen

  const inviteUrl =
    typeof window !== 'undefined' && inviteCode
      ? `${window.location.origin}/join/${inviteCode}`
      : ''

  function copyToClipboard() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('¡Enlace de invitación copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShareWhatsApp() {
    if (!inviteUrl) return
    const text = `¡Sumate a nuestro grupo "${groupName}" en Mesa Mayor para registrar nuestras partidas!\n${inviteUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share && inviteUrl) {
      navigator
        .share({
          title: `Sumate a ${groupName} en Mesa Mayor`,
          text: `Te invito a unirte a nuestro grupo de juegos de mesa "${groupName}".`,
          url: inviteUrl,
        })
        .catch(() => {})
    } else {
      copyToClipboard()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ? (
              (trigger as React.ReactElement)
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Share2 className="size-4" />
                Invitar con link
              </Button>
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Invitar con enlace</DialogTitle>
          <DialogDescription>
            Cualquier persona que reciba este link podrá sumarse a <strong>{groupName}</strong>. Si no tiene cuenta, solo necesitará su usuario y contraseña.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-xs select-all bg-background" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              title="Copiar link"
            >
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white border-0 shadow-sm"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle className="size-4 fill-current" />
              Compartir por WhatsApp
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2 text-xs" onClick={copyToClipboard}>
                {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </Button>
              <Button variant="outline" className="gap-2 text-xs" onClick={handleShare}>
                <Share2 className="size-3.5" />
                Más opciones
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex flex-col gap-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" />
              ¿Cómo funciona?
            </span>
            <span>
              La persona abre el link, crea su cuenta o inicia sesión (sin email, solo usuario y contraseña), y se añade automáticamente a los jugadores de este grupo.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function GroupDetail({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { groups, players, games, matches } = useStore()
  const { data: session } = authClient.useSession()
  const group = groups.find((g) => g.id === groupId)

  if (!group) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Volver
        </Button>
        <p className="text-muted-foreground">Este grupo ya no existe.</p>
      </div>
    )
  }

  // Only creator can delete group (if createdBy is set, must match session.user.id)
  const isCreator = Boolean(
    session?.user?.id && (!group.createdBy || group.createdBy === session.user.id)
  )

  const groupPlayers = players.filter((p) => p.groupId === groupId)
  const groupGames = games.filter((g) => g.groupId === groupId)
  const groupMatches = matches.filter((m) => m.groupId === groupId)
  const stats = computePlayerStats(players, matches, groups, groupId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2">
          <ArrowLeft data-icon="inline-start" />
          Todos los grupos
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              {group.name}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex -space-x-2">
                {groupPlayers.map((p) => (
                  <PlayerAvatar
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    className="size-8 ring-2 ring-background"
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {groupPlayers.map((p) => p.name).join(', ')}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <InviteGroupDialog groupName={group.name} inviteCode={group.inviteCode} />
            <AddPlayerDialog groupId={groupId} />
            <AddGameDialog groupId={groupId} />
            <RecordMatchDialog groupId={groupId} />
            <LeaveGroupDialog
              groupId={groupId}
              groupName={group.name}
              isCreator={isCreator}
              memberCount={groupPlayers.length}
              onSuccess={onBack}
            />
            {isCreator && (
              <DeleteGroupDialog
                groupId={groupId}
                groupName={group.name}
                onSuccess={onBack}
              />
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">
            <Trophy data-icon="inline-start" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="games">
            <Gamepad2 data-icon="inline-start" />
            Juegos
          </TabsTrigger>
          <TabsTrigger value="history">
            <ScrollText data-icon="inline-start" />
            Partidas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="pt-4">
          {groupMatches.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card/50 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Trophy />
                </EmptyMedia>
                <EmptyTitle>El podio está vacío</EmptyTitle>
                <EmptyDescription>
                  Registrá partidas y el ranking de este grupo se va a armar solo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Leaderboard stats={stats} />
          )}
        </TabsContent>

        <TabsContent value="games" className="pt-4">
          {groupGames.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card/50 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Gamepad2 />
                </EmptyMedia>
                <EmptyTitle>Todavía no hay juegos</EmptyTitle>
                <EmptyDescription>Agregá el primer juego al que van a jugar.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupGames.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <MatchHistory matches={groupMatches} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
