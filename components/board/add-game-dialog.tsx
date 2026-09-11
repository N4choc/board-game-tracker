'use client'

import * as React from 'react'
import { ImagePlus, Plus, X } from 'lucide-react'
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { useStore } from '@/lib/store'
import { authClient } from '@/lib/auth-client'

function compressImage(file: File, maxDim = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Error al procesar la imagen'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export function AddGameDialog({ groupId }: { groupId: string }) {
  const { addGame } = useStore()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [minutes, setMinutes] = React.useState('')
  const [photo, setPhoto] = React.useState<string | undefined>()
  const fileRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setName('')
    setCategory('')
    setMinutes('')
    setPhoto(undefined)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
    } catch {
      toast.error('No se pudo procesar la imagen')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) {
      toast.error('Tenés que iniciar sesión para agregar juegos')
      return
    }
    if (!name.trim()) {
      toast.error('Ponele un nombre al juego')
      return
    }

    setIsSubmitting(true)
    try {
      const ok = await addGame({
        groupId,
        name: name.trim(),
        category: category.trim() || undefined,
        suggestedMinutes: minutes ? Number(minutes) : undefined,
        photoUrl: photo,
      })
      if (ok) {
        toast.success(`"${name.trim()}" agregado`)
        setOpen(false)
        reset()
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
            Agregar juego
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Agregar un juego</DialogTitle>
          <DialogDescription>
            Sumá un juego al que este grupo va a jugar. Podés cargarle una foto de la caja.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Foto (opcional)</FieldLabel>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onFile}
              />
              {photo ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo || '/placeholder.svg'} alt="Vista previa del juego" className="h-36 w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute right-2 top-2"
                    aria-label="Quitar foto"
                    onClick={() => {
                      setPhoto(undefined)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <ImagePlus className="size-5" />
                  Subir imagen
                </button>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="game-name">Nombre</FieldLabel>
              <Input
                id="game-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Colonos del Valle"
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="game-category">Categoría</FieldLabel>
              <Input
                id="game-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Estrategia, Dados, Cartas…"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="game-minutes">Duración sugerida (min)</FieldLabel>
              <Input
                id="game-minutes"
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="60"
              />
              <FieldDescription>Una referencia de cuánto suele durar una partida.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar juego'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
